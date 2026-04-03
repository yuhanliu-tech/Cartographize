// Cartographize - Satellite Image Terrain Segmentation Application

class TerrainSegmenter {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.gl = null;
        this.program = null;
        this.postProcessProgram = null;
        this.framebuffer = null;
        this.framebufferTexture = null;
        this.originalTexture = null;
        this.segmentedTexture = null;
        this.vertices = null;
        this.vertexBuffer = null;
        this.currentImage = null;
        this.segmentedImageData = null;
        this.sensitivity = 1.0;
        this.mode = 'segmented';
        
        // Animation timing for procedural effects
        this.startTime = Date.now();
        this.animationId = null;
        
        // Terrain classification colors (target colors for segmentation)
        this.terrainColors = {
            water: [74, 144, 226, 255],      // Blue
            forest: [126, 211, 33, 255],     // Green  
            city: [155, 155, 155, 255],      // Gray
            mountain: [139, 69, 19, 255],    // Brown
            desert: [245, 166, 35, 255]      // Yellow
        };
        
        this.init();
        this.setupEventListeners();
    }
    
    async init() {
        // Get WebGL context
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        
        if (!this.gl) {
            alert('WebGL not supported in this browser!');
            return;
        }
        
        // Set viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Create shader program
        await this.createShaderProgram();
        
        // Create post-processing shader program
        await this.createPostProcessShader();
        
        // Create framebuffer for two-pass rendering
        this.createFramebuffer();
        
        // Create vertex buffer for a full-screen quad
        this.createQuad();
        
        // Set clear color (dark green terrain theme)
        this.gl.clearColor(0.1, 0.2, 0.1, 1.0);
        
        // Enable blending
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        
        // Initial render
        this.render();
        
        // Start animation loop for procedural effects
        this.startAnimationLoop();
    }
    
    async loadShaderFile(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to load shader: ${path}`);
        }
        return await response.text();
    }
    
    async createShaderProgram() {
        try {
            // Load shader sources from external files
            console.log('Loading external shader files...');
            const vertexShaderSource = await this.loadShaderFile('./shaders/vertex.glsl');
            const fragmentShaderSource = await this.loadShaderFile('./shaders/fragment.glsl');
            
            console.log('✓ Successfully loaded shader files');
            
            // Create shaders
            const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
            
            if (!vertexShader || !fragmentShader) {
                throw new Error('Failed to compile shaders');
            }
            
            // Create program
            this.program = this.gl.createProgram();
            this.gl.attachShader(this.program, vertexShader);
            this.gl.attachShader(this.program, fragmentShader);
            this.gl.linkProgram(this.program);
            
            if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
                console.error('Error linking shader program:', this.gl.getProgramInfoLog(this.program));
                throw new Error('Failed to link shader program');
            }
            
            this.gl.useProgram(this.program);
            
            // Get attribute and uniform locations
            this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
            this.texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
            this.originalTextureLocation = this.gl.getUniformLocation(this.program, 'u_originalTexture');
            this.segmentedTextureLocation = this.gl.getUniformLocation(this.program, 'u_segmentedTexture');
            this.modeLocation = this.gl.getUniformLocation(this.program, 'u_mode');
            this.hasTextureLocation = this.gl.getUniformLocation(this.program, 'u_hasTexture');
            this.overlayStrengthLocation = this.gl.getUniformLocation(this.program, 'u_overlayStrength');
            this.timeLocation = this.gl.getUniformLocation(this.program, 'u_time');
            this.resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
            
            // Enable attributes
            this.gl.enableVertexAttribArray(this.positionLocation);
            this.gl.enableVertexAttribArray(this.texCoordLocation);
            
            console.log('✓ Shader program successfully created and linked');
            
        } catch (error) {
            console.error('Failed to create shader program:', error);
            alert('Critical error: Failed to load or compile shaders. Please ensure the shaders folder contains vertex.glsl and fragment.glsl files, and serve the page via HTTP (e.g., using Live Server extension).');
            throw error;
        }
    }
    
    async createPostProcessShader() {
        try {
            // Load shaders from external files
            console.log('Loading post-process shader files...');
            const vertexShaderSource = await this.loadShaderFile('./shaders/vertex.glsl');
            const postProcessShaderSource = await this.loadShaderFile('./shaders/postprocess.glsl');
            
            console.log('✓ Successfully loaded post-process shader files');
            
            // Create post-process shaders
            const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, postProcessShaderSource);
            
            if (!vertexShader || !fragmentShader) {
                throw new Error('Failed to compile post-process shaders');
            }
            
            // Create post-process program
            this.postProcessProgram = this.gl.createProgram();
            this.gl.attachShader(this.postProcessProgram, vertexShader);
            this.gl.attachShader(this.postProcessProgram, fragmentShader);
            this.gl.linkProgram(this.postProcessProgram);
            
            if (!this.gl.getProgramParameter(this.postProcessProgram, this.gl.LINK_STATUS)) {
                console.error('Error linking post-process shader program:', this.gl.getProgramInfoLog(this.postProcessProgram));
                throw new Error('Failed to link post-process shader program');
            }
            
            // Get post-process uniform locations
            this.postProcessInputTextureLocation = this.gl.getUniformLocation(this.postProcessProgram, 'u_inputTexture');
            this.postProcessTimeLocation = this.gl.getUniformLocation(this.postProcessProgram, 'u_time');
            this.postProcessResolutionLocation = this.gl.getUniformLocation(this.postProcessProgram, 'u_resolution');
            this.postProcessPositionLocation = this.gl.getAttribLocation(this.postProcessProgram, 'a_position');
            this.postProcessTexCoordLocation = this.gl.getAttribLocation(this.postProcessProgram, 'a_texCoord');
            
            console.log('✓ Post-process shader program successfully created');
            
        } catch (error) {
            console.error('Failed to create post-process shader program:', error);
            console.warn('Post-processing disabled. The app will run with basic terrain effects only.');
            // Don't block the app, just disable post-processing
            this.postProcessProgram = null;
        }
    }
    
    createFramebuffer() {
        // Create framebuffer for first rendering pass
        this.framebuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
        
        // Create texture to render to
        this.framebufferTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.framebufferTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.canvas.width, this.canvas.height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        
        // Attach texture to framebuffer
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.framebufferTexture, 0);
        
        // Check framebuffer status
        if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
            console.error('Framebuffer not complete');
        }
        
        // Bind back to default framebuffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        
        console.log('✓ Framebuffer created for dual-pass rendering');
    }
    
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Error compiling shader:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    createQuad() {
        // Define vertices for a full-screen quad with texture coordinates
        this.vertices = new Float32Array([
            // Position (x, y)  // Texture coordinates (u, v)
            -1.0, -1.0,         0.0, 1.0,  // Bottom left
             1.0, -1.0,         1.0, 1.0,  // Bottom right
            -1.0,  1.0,         0.0, 0.0,  // Top left
            -1.0,  1.0,         0.0, 0.0,  // Top left
             1.0, -1.0,         1.0, 1.0,  // Bottom right
             1.0,  1.0,         1.0, 0.0   // Top right
        ]);
        
        // Create vertex buffer
        this.vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertices, this.gl.STATIC_DRAW);
    }
    
    setupEventListeners() {
        const imageInput = document.getElementById('imageInput');
        const segmentationMode = document.getElementById('segmentationMode');
        const sensitivity = document.getElementById('sensitivity');
        const sensitivityValue = document.getElementById('sensitivityValue');
        const processBtn = document.getElementById('processBtn');
        
        imageInput.addEventListener('change', (event) => {
            this.handleImageUpload(event);
        });
        
        segmentationMode.addEventListener('change', (event) => {
            this.mode = event.target.value;
            this.render();
        });
        
        sensitivity.addEventListener('input', (event) => {
            this.sensitivity = parseFloat(event.target.value);
            sensitivityValue.textContent = this.sensitivity.toFixed(1);
        });
        
        processBtn.addEventListener('click', () => {
            if (this.currentImage) {
                this.processTerrainSegmentation();
            } else {
                alert('Please upload a satellite image first!');
            }
        });
        
        // Initialize loading indicator
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        this.loadingProgress = document.getElementById('loadingProgress');
    }
    
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                this.loadOriginalTexture(img);
                this.updateCanvasSize(img);
                setTimeout(() => {
                    this.processTerrainSegmentation();
                }, 100); // Allow UI to update after image load
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    processTerrainSegmentation() {
        if (!this.currentImage) return;
        
        // Show loading indicator
        this.showLoading('Processing terrain segmentation...', 'Initializing image processing...');
        
        // Use setTimeout to allow UI to update before heavy processing
        setTimeout(() => {
            try {
                console.log('Processing terrain segmentation...');
                
                // Create a canvas to process the image
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = this.currentImage.width;
                canvas.height = this.currentImage.height;
                
                // Draw the image to get pixel data
                ctx.drawImage(this.currentImage, 0, 0);
                let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Apply preprocessing steps to improve segmentation
                this.updateLoadingProgress('Applying Gaussian blur...');
                console.log('Applying blur preprocessing...');
                imageData = this.applyGaussianBlur(imageData, 2.0);
                
                this.updateLoadingProgress('Removing text and noise...');
                console.log('Removing text and noise...');
                imageData = this.removeTextAndNoise(imageData);
                
                this.updateLoadingProgress('Applying noise reduction...');
                console.log('Applying noise reduction...');
                imageData = this.applyMedianFilter(imageData, 1);
                const data = imageData.data;
                
                // Process each pixel for terrain classification
                this.updateLoadingProgress('Classifying terrain features...');
                const totalPixels = data.length / 4;
                let processedPixels = 0;
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1]; 
                    const b = data[i + 2];
                    
                    const terrainType = this.classifyTerrain(r, g, b);
                    const newColor = this.terrainColors[terrainType];
                    
                    data[i] = newColor[0];     // R
                    data[i + 1] = newColor[1]; // G
                    data[i + 2] = newColor[2]; // B
                    data[i + 3] = newColor[3]; // A
                    
                    processedPixels++;
                    
                    // Update progress every 10% of pixels processed
                    if (processedPixels % Math.floor(totalPixels / 10) === 0) {
                        const progress = Math.round((processedPixels / totalPixels) * 100);
                        this.updateLoadingProgress(`Classifying terrain features... ${progress}%`);
                    }
                }
                
                // Create a new image from the processed data
                this.updateLoadingProgress('Finalizing segmentation...');
                ctx.putImageData(imageData, 0, 0);
                
                // Create texture from processed canvas
                this.loadSegmentedTexture(canvas);
                this.render();
                
                console.log('Terrain segmentation complete!');
                
                // Hide loading indicator
                setTimeout(() => {
                    this.hideLoading();
                }, 500); // Small delay to show completion
                
            } catch (error) {
                console.error('Error during segmentation:', error);
                this.hideLoading();
                alert('Error processing image. Please try again.');
            }
        }, 100); // Allow UI to update before processing
    }
    
    showLoading(mainText, progressText) {
        this.loadingText.textContent = mainText;
        this.loadingProgress.textContent = progressText;
        this.loadingOverlay.classList.remove('hidden');
    }
    
    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }
    
    updateLoadingProgress(progressText) {
        this.loadingProgress.textContent = progressText;
        // Force a repaint by accessing the element's offsetHeight
        this.loadingProgress.offsetHeight;
    }
    
    classifyTerrain(r, g, b) {
        // Terrain classification based on satellite image color analysis
        // These heuristics are based on typical colors in satellite imagery
        
        const sensitivity = this.sensitivity;
        
        // Water detection: blue-ish colors, often darker
        if (b > r * 1.1 && b > g * 1.0 && (b > 60 || (r < 100 && g < 120))) {
            return 'water';
        }
        
        // Forest/vegetation detection: green dominant, moderate brightness
        if (g > r * 1.1 * sensitivity && g > b * 1.0 && g > 40) {
            return 'forest';
        }
        
        // Desert detection: yellowish, high red and green, low blue
        if (r > 120 * sensitivity && g > 100 * sensitivity && b < 80 && 
            Math.abs(r - g) < 50 && r > b * 1.3) {
            return 'desert';
        }
        
        // Mountain detection: brownish/grayish colors, often with varied tones
        if ((r + g + b) / 3 < 140 && Math.abs(r - g) < 30 && 
            Math.abs(g - b) < 30 && b < r * 1.1) {
            return 'mountain';
        }
        
        // Urban/city detection: gray tones, uniform colors, higher brightness
        if (Math.abs(r - g) < 20 * sensitivity && Math.abs(g - b) < 20 * sensitivity && 
            Math.abs(r - b) < 20 * sensitivity && (r + g + b) / 3 > 80) {
            return 'city';
        }
        
        // Default to forest for unclassified green-ish areas
        if (g >= r && g >= b) {
            return 'forest';
        }
        
        // Default to mountain for everything else
        return 'mountain';
    }
    
    applyGaussianBlur(imageData, radius) {
        const data = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;
        
        // Create Gaussian kernel
        const kernelSize = Math.ceil(radius * 3) * 2 + 1;
        const kernel = this.createGaussianKernel(kernelSize, radius);
        const halfKernel = Math.floor(kernelSize / 2);
        
        // Apply horizontal blur
        const tempData = new Uint8ClampedArray(data);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                for (let c = 0; c < 3; c++) { // RGB channels only
                    let sum = 0;
                    let weightSum = 0;
                    
                    for (let k = -halfKernel; k <= halfKernel; k++) {
                        const px = Math.max(0, Math.min(width - 1, x + k));
                        const weight = kernel[k + halfKernel];
                        sum += data[(y * width + px) * 4 + c] * weight;
                        weightSum += weight;
                    }
                    
                    tempData[(y * width + x) * 4 + c] = sum / weightSum;
                }
            }
        }
        
        // Apply vertical blur
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                for (let c = 0; c < 3; c++) { // RGB channels only
                    let sum = 0;
                    let weightSum = 0;
                    
                    for (let k = -halfKernel; k <= halfKernel; k++) {
                        const py = Math.max(0, Math.min(height - 1, y + k));
                        const weight = kernel[k + halfKernel];
                        sum += tempData[(py * width + x) * 4 + c] * weight;
                        weightSum += weight;
                    }
                    
                    data[(y * width + x) * 4 + c] = sum / weightSum;
                }
            }
        }
        
        return new ImageData(data, width, height);
    }
    
    createGaussianKernel(size, sigma) {
        const kernel = new Array(size);
        const center = Math.floor(size / 2);
        let sum = 0;
        
        for (let i = 0; i < size; i++) {
            const x = i - center;
            kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
            sum += kernel[i];
        }
        
        // Normalize kernel
        for (let i = 0; i < size; i++) {
            kernel[i] /= sum;
        }
        
        return kernel;
    }
    
    removeTextAndNoise(imageData) {
        const data = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;
        
        // Convert to grayscale for edge detection
        const grayscale = new Uint8ClampedArray(width * height);
        for (let i = 0; i < width * height; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }
        
        // Apply edge detection (Sobel operator)
        const edges = new Uint8ClampedArray(width * height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const gx = 
                    -1 * grayscale[(y - 1) * width + (x - 1)] +
                     1 * grayscale[(y - 1) * width + (x + 1)] +
                    -2 * grayscale[y * width + (x - 1)] +
                     2 * grayscale[y * width + (x + 1)] +
                    -1 * grayscale[(y + 1) * width + (x - 1)] +
                     1 * grayscale[(y + 1) * width + (x + 1)];
                
                const gy = 
                    -1 * grayscale[(y - 1) * width + (x - 1)] +
                    -2 * grayscale[(y - 1) * width + x] +
                    -1 * grayscale[(y - 1) * width + (x + 1)] +
                     1 * grayscale[(y + 1) * width + (x - 1)] +
                     2 * grayscale[(y + 1) * width + x] +
                     1 * grayscale[(y + 1) * width + (x + 1)];
                
                edges[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
            }
        }
        
        // Identify text-like regions (high edge density in small areas)
        const textMask = new Uint8ClampedArray(width * height);
        const windowSize = 5;
        const threshold = 20;
        
        for (let y = windowSize; y < height - windowSize; y++) {
            for (let x = windowSize; x < width - windowSize; x++) {
                let edgeCount = 0;
                let totalPixels = 0;
                
                for (let dy = -windowSize; dy <= windowSize; dy++) {
                    for (let dx = -windowSize; dx <= windowSize; dx++) {
                        if (edges[(y + dy) * width + (x + dx)] > 50) {
                            edgeCount++;
                        }
                        totalPixels++;
                    }
                }
                
                if (edgeCount / totalPixels > 0.3) { // High edge density
                    textMask[y * width + x] = 255;
                }
            }
        }
        
        // Remove text regions by replacing with surrounding colors
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (textMask[idx] > 0) {
                    // Find nearest non-text pixel and use its color
                    let found = false;
                    for (let radius = 1; radius <= 10 && !found; radius++) {
                        for (let dy = -radius; dy <= radius && !found; dy++) {
                            for (let dx = -radius; dx <= radius && !found; dx++) {
                                const ny = y + dy;
                                const nx = x + dx;
                                if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                                    const nIdx = ny * width + nx;
                                    if (textMask[nIdx] === 0) {
                                        data[idx * 4] = data[nIdx * 4];     // R
                                        data[idx * 4 + 1] = data[nIdx * 4 + 1]; // G
                                        data[idx * 4 + 2] = data[nIdx * 4 + 2]; // B
                                        found = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return new ImageData(data, width, height);
    }
    
    applyMedianFilter(imageData, radius) {
        const data = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;
        const windowSize = radius * 2 + 1;
        
        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                for (let c = 0; c < 3; c++) { // RGB channels only
                    const values = [];
                    
                    // Collect values in the window
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            const px = x + dx;
                            const py = y + dy;
                            values.push(data[(py * width + px) * 4 + c]);
                        }
                    }
                    
                    // Sort and find median
                    values.sort((a, b) => a - b);
                    const median = values[Math.floor(values.length / 2)];
                    data[(y * width + x) * 4 + c] = median;
                }
            }
        }
        
        return new ImageData(data, width, height);
    }
    
    updateCanvasSize(img) {
        const maxWidth = 800;
        const maxHeight = 600;
        
        let { width, height } = img;
        
        // Scale to fit within max dimensions while maintaining aspect ratio
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width *= scale;
        height *= scale;
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        this.gl.viewport(0, 0, width, height);
        
        // Update framebuffer size
        if (this.framebufferTexture) {
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.framebufferTexture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
        }
    }
    
    loadOriginalTexture(image) {
        // Delete existing texture if it exists
        if (this.originalTexture) {
            this.gl.deleteTexture(this.originalTexture);
        }
        
        // Create new texture
        this.originalTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.originalTexture);
        
        // Set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        
        // Flip Y coordinate to match WebGL texture coordinate system
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        
        // Upload image to texture
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
    }
    
    loadSegmentedTexture(canvas) {
        // Delete existing segmented texture if it exists
        if (this.segmentedTexture) {
            this.gl.deleteTexture(this.segmentedTexture);
        }
        
        // Create new segmented texture
        this.segmentedTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.segmentedTexture);
        
        // Set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        
        // Flip Y coordinate to match WebGL texture coordinate system
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        
        // Upload canvas to texture
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
    }
    
    render() {
        if (!this.postProcessProgram) {
            // Single-pass rendering (fallback)
            this.renderSinglePass();
            return;
        }
        
        // **PASS 1: Render terrain effects to framebuffer**
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        this.renderTerrainPass();
        
        // **PASS 2: Render post-processed result to canvas**
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        this.renderPostProcessPass();
    }
    
    renderSinglePass() {
        // Original single-pass rendering for fallback
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.renderTerrainPass();
    }
    
    renderTerrainPass() {
        // Use main shader program for terrain effects
        this.gl.useProgram(this.program);
        
        // Bind vertex buffer and set up attributes
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        
        // Position attribute (2 floats per vertex)
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 16, 0);
        this.gl.enableVertexAttribArray(this.positionLocation);
        
        // Texture coordinate attribute (2 floats per vertex, offset by 8 bytes)
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 16, 8);
        this.gl.enableVertexAttribArray(this.texCoordLocation);
        
        // Set uniforms for terrain rendering
        if (this.originalTexture) {
            // Bind original texture to texture unit 0
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.originalTexture);
            this.gl.uniform1i(this.originalTextureLocation, 0);
            
            // Bind segmented texture to texture unit 1 (if available)
            if (this.segmentedTexture) {
                this.gl.activeTexture(this.gl.TEXTURE1);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.segmentedTexture);
                this.gl.uniform1i(this.segmentedTextureLocation, 1);
            }
            
            // Set mode uniform
            let modeValue = 0; // original
            if (this.mode === 'segmented') modeValue = 1;
            else if (this.mode === 'overlay') modeValue = 2;
            
            this.gl.uniform1i(this.modeLocation, modeValue);
            this.gl.uniform1f(this.overlayStrengthLocation, 0.7); // 70% overlay strength
            this.gl.uniform1i(this.hasTextureLocation, 1);
            
            // Set time uniform for animations
            const currentTime = (Date.now() - this.startTime) / 1000.0;
            this.gl.uniform1f(this.timeLocation, currentTime);
            
            // Set resolution uniform
            this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
        } else {
            this.gl.uniform1i(this.hasTextureLocation, 0);
        }
        
        // Draw the quad
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }
    
    renderPostProcessPass() {
        // Use post-process shader program
        this.gl.useProgram(this.postProcessProgram);
        
        // Bind vertex buffer and set up attributes for post-processing
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        
        // Position attribute
        this.gl.vertexAttribPointer(this.postProcessPositionLocation, 2, this.gl.FLOAT, false, 16, 0);
        this.gl.enableVertexAttribArray(this.postProcessPositionLocation);
        
        // Texture coordinate attribute
        this.gl.vertexAttribPointer(this.postProcessTexCoordLocation, 2, this.gl.FLOAT, false, 16, 8);
        this.gl.enableVertexAttribArray(this.postProcessTexCoordLocation);
        
        // Bind the framebuffer texture as input
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.framebufferTexture);
        this.gl.uniform1i(this.postProcessInputTextureLocation, 0);
        
        // Set post-process uniforms
        const currentTime = (Date.now() - this.startTime) / 1000.0;
        this.gl.uniform1f(this.postProcessTimeLocation, currentTime);
        this.gl.uniform2f(this.postProcessResolutionLocation, this.canvas.width, this.canvas.height);
        
        // Draw the post-processed quad
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }
    
    startAnimationLoop() {
        const animate = () => {
            this.render();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }
    
    stopAnimationLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TerrainSegmenter();
});