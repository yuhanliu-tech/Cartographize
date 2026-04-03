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
}