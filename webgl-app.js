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
    
    init() {
        // Get WebGL context
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        
        if (!this.gl) {
            alert('WebGL not supported in this browser!');
            return;
        }
        
        // Set viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Create shader program
        this.createShaderProgram();
        
        // Create vertex buffer for a full-screen quad
        this.createQuad();
        
        // Set clear color (dark green terrain theme)
        this.gl.clearColor(0.1, 0.2, 0.1, 1.0);
        
        // Enable blending
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        
        // Initial render
        this.render();
    }
    
    createShaderProgram() {
        // Vertex shader source
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
        
        // Fragment shader source with terrain segmentation
        const fragmentShaderSource = `
            precision mediump float;
            uniform sampler2D u_originalTexture;
            uniform sampler2D u_segmentedTexture;
            uniform int u_mode; // 0: original, 1: segmented, 2: overlay
            uniform bool u_hasTexture;
            uniform float u_overlayStrength;
            varying vec2 v_texCoord;
            
            void main() {
                if (u_hasTexture) {
                    vec4 originalColor = texture2D(u_originalTexture, v_texCoord);
                    
                    if (u_mode == 0) {
                        // Original mode
                        gl_FragColor = originalColor;
                    } else if (u_mode == 1) {
                        // Segmented mode
                        vec4 segmentedColor = texture2D(u_segmentedTexture, v_texCoord);
                        gl_FragColor = segmentedColor;
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
            }
        `;
        
        // Create shaders
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        // Create program
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);
        
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('Error linking shader program:', this.gl.getProgramInfoLog(this.program));
            return;
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
        
        // Enable attributes
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.enableVertexAttribArray(this.texCoordLocation);
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
                this.processTerrainSegmentation();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    processTerrainSegmentation() {
        if (!this.currentImage) return;
        
        console.log('Processing terrain segmentation...');
        
        // Create a canvas to process the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = this.currentImage.width;
        canvas.height = this.currentImage.height;
        
        // Draw the image to get pixel data
        ctx.drawImage(this.currentImage, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Process each pixel for terrain classification
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
        }
        
        // Create a new image from the processed data
        ctx.putImageData(imageData, 0, 0);
        
        // Create texture from processed canvas
        this.loadSegmentedTexture(canvas);
        this.render();
        
        console.log('Terrain segmentation complete!');
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
        } else {
            this.gl.uniform1i(this.hasTextureLocation, 0);
        }
        
        // Draw the quad
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TerrainSegmenter();
});