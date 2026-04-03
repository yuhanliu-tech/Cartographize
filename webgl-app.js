// Cartographize - Satellite Image Terrain Segmentation Application

class TerrainSegmenter {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.gl = null;
        this.program = null;
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
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to load shader: ${path}`);
            }
            return await response.text();
        } catch (error) {
            console.warn('Failed to load external shader file:', error.message);
            console.log('Note: If running locally, use a local server (e.g., Live Server extension) or the fallback shaders will be used.');
            throw error;
        }
    }
    
    getFallbackVertexShader() {
        return `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}`;
    }
    
    getFallbackFragmentShader() {
        return `
precision mediump float;
uniform sampler2D u_originalTexture;
uniform sampler2D u_segmentedTexture;
uniform int u_mode; // 0: original, 1: segmented, 2: overlay
uniform bool u_hasTexture;
uniform float u_overlayStrength;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

// Noise functions for procedural patterns
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 0.0;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Water wave patterns
vec3 applyWaterPattern(vec3 baseColor, vec2 uv) {
    vec2 waveUv = uv * 15.0;
    float wave1 = sin(waveUv.x * 2.0 + u_time * 2.0) * 0.5 + 0.5;
    float wave2 = sin(waveUv.y * 1.5 + u_time * 1.5) * 0.5 + 0.5;
    float wave3 = sin((waveUv.x + waveUv.y) * 1.2 + u_time * 0.8) * 0.5 + 0.5;
    
    float waves = (wave1 + wave2 + wave3) / 3.0;
    waves = smoothstep(0.3, 0.7, waves);
    
    vec3 lightWater = vec3(0.4, 0.7, 0.9);
    vec3 darkWater = vec3(0.1, 0.3, 0.6);
    
    return mix(darkWater, lightWater, waves);
}

// Mountain ridge patterns
vec3 applyMountainPattern(vec3 baseColor, vec2 uv) {
    vec2 ridgeUv = uv * 20.0;
    float ridges = fbm(ridgeUv * 0.5);
    ridges += fbm(ridgeUv * 1.0) * 0.5;
    ridges += fbm(ridgeUv * 2.0) * 0.25;
    
    ridges = smoothstep(0.2, 0.8, ridges);
    
    vec3 darkBrown = vec3(0.3, 0.2, 0.1);
    vec3 lightBrown = vec3(0.7, 0.5, 0.3);
    vec3 snow = vec3(0.9, 0.9, 0.95);
    
    vec3 mountainColor = mix(darkBrown, lightBrown, ridges);
    if (ridges > 0.7) {
        mountainColor = mix(mountainColor, snow, (ridges - 0.7) * 3.33);
    }
    
    return mountainColor;
}

// Forest leaf patterns
vec3 applyForestPattern(vec3 baseColor, vec2 uv) {
    vec2 leafUv = uv * 25.0;
    float leaves1 = fbm(leafUv);
    float leaves2 = fbm(leafUv * 1.5 + vec2(100.0, 50.0));
    
    float pattern = abs(sin(leaves1 * 6.28) * sin(leaves2 * 6.28));
    pattern = smoothstep(0.1, 0.9, pattern);
    
    vec3 darkGreen = vec3(0.1, 0.3, 0.1);
    vec3 lightGreen = vec3(0.3, 0.7, 0.2);
    vec3 brightGreen = vec3(0.5, 0.9, 0.3);
    
    vec3 forestColor = mix(darkGreen, lightGreen, pattern);
    if (pattern > 0.7) {
        forestColor = mix(forestColor, brightGreen, (pattern - 0.7) * 3.33);
    }
    
    return forestColor;
}

// City building patterns
vec3 applyCityPattern(vec3 baseColor, vec2 uv) {
    vec2 buildingUv = uv * 30.0;
    vec2 grid = fract(buildingUv) - 0.5;
    float building = step(0.1, abs(grid.x)) * step(0.1, abs(grid.y));
    
    vec2 windowUv = fract(buildingUv * 3.0);
    float windows = step(0.3, windowUv.x) * step(0.7, windowUv.x) * 
                   step(0.3, windowUv.y) * step(0.7, windowUv.y);
    
    vec3 concrete = vec3(0.5, 0.5, 0.55);
    vec3 darkConcrete = vec3(0.3, 0.3, 0.35);
    vec3 windowLight = vec3(1.0, 0.9, 0.6);
    
    vec3 cityColor = mix(darkConcrete, concrete, building);
    cityColor = mix(cityColor, windowLight, windows * building * 0.7);
    
    return cityColor;
}

// Desert dune patterns
vec3 applyDesertPattern(vec3 baseColor, vec2 uv) {
    vec2 duneUv = uv * 12.0;
    float dunes = fbm(duneUv * 0.3);
    dunes += sin(duneUv.x * 2.0) * sin(duneUv.y * 1.5) * 0.3;
    
    dunes = smoothstep(0.2, 0.8, dunes);
    
    vec3 darkSand = vec3(0.8, 0.6, 0.2);
    vec3 lightSand = vec3(1.0, 0.9, 0.6);
    vec3 goldSand = vec3(1.0, 0.8, 0.3);
    
    vec3 desertColor = mix(darkSand, lightSand, dunes);
    if (dunes > 0.6) {
        desertColor = mix(desertColor, goldSand, (dunes - 0.6) * 2.5);
    }
    
    return desertColor;
}

// Identify terrain type by color
int identifyTerrain(vec3 color) {
    // Water: [74, 144, 226] / 255 = [0.29, 0.565, 0.886]
    if (abs(color.r - 0.29) < 0.1 && abs(color.g - 0.565) < 0.1 && abs(color.b - 0.886) < 0.1) {
        return 0; // Water
    }
    // Forest: [126, 211, 33] / 255 = [0.494, 0.827, 0.129]
    if (abs(color.r - 0.494) < 0.1 && abs(color.g - 0.827) < 0.1 && abs(color.b - 0.129) < 0.1) {
        return 1; // Forest
    }
    // City: [155, 155, 155] / 255 = [0.608, 0.608, 0.608]
    if (abs(color.r - 0.608) < 0.1 && abs(color.g - 0.608) < 0.1 && abs(color.b - 0.608) < 0.1) {
        return 2; // City
    }
    // Mountain: [139, 69, 19] / 255 = [0.545, 0.271, 0.075]
    if (abs(color.r - 0.545) < 0.1 && abs(color.g - 0.271) < 0.1 && abs(color.b - 0.075) < 0.1) {
        return 3; // Mountain
    }
    // Desert: [245, 166, 35] / 255 = [0.961, 0.651, 0.137]
    if (abs(color.r - 0.961) < 0.1 && abs(color.g - 0.651) < 0.1 && abs(color.b - 0.137) < 0.1) {
        return 4; // Desert
    }
    return -1; // Unknown
}

void main() {
    if (u_hasTexture) {
        vec4 originalColor = texture2D(u_originalTexture, v_texCoord);
        
        if (u_mode == 0) {
            // Original mode
            gl_FragColor = originalColor;
        } else if (u_mode == 1) {
            // Segmented mode with procedural patterns
            vec4 segmentedColor = texture2D(u_segmentedTexture, v_texCoord);
            
            int terrainType = identifyTerrain(segmentedColor.rgb);
            vec3 finalColor = segmentedColor.rgb;
            
            if (terrainType == 0) {
                finalColor = applyWaterPattern(segmentedColor.rgb, v_texCoord);
            } else if (terrainType == 1) {
                finalColor = applyForestPattern(segmentedColor.rgb, v_texCoord);
            } else if (terrainType == 2) {
                finalColor = applyCityPattern(segmentedColor.rgb, v_texCoord);
            } else if (terrainType == 3) {
                finalColor = applyMountainPattern(segmentedColor.rgb, v_texCoord);
            } else if (terrainType == 4) {
                finalColor = applyDesertPattern(segmentedColor.rgb, v_texCoord);
            }
            
            gl_FragColor = vec4(finalColor, segmentedColor.a);
        } else {
            // Overlay mode
            vec4 segmentedColor = texture2D(u_segmentedTexture, v_texCoord);
            gl_FragColor = mix(originalColor, segmentedColor, u_overlayStrength);
        }
    } else {
        // Default terrain-themed gradient when no image is loaded
        vec2 uv = v_texCoord;
        vec3 color1 = vec3(0.2, 0.4, 0.2); // Dark green
        vec3 color2 = vec3(0.1, 0.6, 0.3); // Forest green
        vec3 color = mix(color1, color2, uv.x * uv.y);
        gl_FragColor = vec4(color, 1.0);
    }
}`;
    }
    
    async createShaderProgram() {
        let vertexShaderSource, fragmentShaderSource;
        
        try {
            // Try to load shader sources from external files first
            console.log('Attempting to load external shader files...');
            vertexShaderSource = await this.loadShaderFile('./shaders/vertex.glsl');
            fragmentShaderSource = await this.loadShaderFile('./shaders/fragment.glsl');
            
            console.log('✓ Successfully loaded external shader files');
            console.log('Vertex shader preview:', vertexShaderSource.substring(0, 50) + '...');
            console.log('Fragment shader preview:', fragmentShaderSource.substring(0, 50) + '...');
            
        } catch (error) {
            // Fall back to inline shaders if external files can't be loaded
            console.warn('External shader loading failed, using fallback inline shaders');
            console.log('💡 Tip: For external shader files to work, serve this page via HTTP (e.g., use Live Server extension)');
            
            vertexShaderSource = this.getFallbackVertexShader();
            fragmentShaderSource = this.getFallbackFragmentShader();
            
            console.log('✓ Using fallback inline shaders');
        }
        
        try {
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
            alert('Critical error: Failed to compile shaders. Check browser console for details.');
            throw error;
        }
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
        
        // Upload canvas to texture
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
    }
    
    render() {
        // Clear the canvas
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        // Use our shader program
        this.gl.useProgram(this.program);
        
        // Bind vertex buffer and set up attributes
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        
        // Position attribute (2 floats per vertex)
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 16, 0);
        
        // Texture coordinate attribute (2 floats per vertex, offset by 8 bytes)
        this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 16, 8);
        
        // Set uniforms
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