precision mediump float;
uniform sampler2D u_inputTexture;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

// Noise function for aging effects
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
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Paper texture generation
float paperTexture(vec2 uv) {
    // Multiple noise layers for paper fiber texture
    float paper = 0.0;
    paper += noise(uv * 80.0) * 0.4;
    paper += noise(uv * 160.0) * 0.2;
    paper += noise(uv * 320.0) * 0.1;
    paper += noise(uv * 640.0) * 0.05;
    return paper;
}

// Ink blot effects
float inkBlots(vec2 uv) {
    vec2 blotUv = uv * 10.0;
    float blots = 0.0;
    
    // Create irregular ink spots
    for (int i = 0; i < 8; i++) {
        vec2 center = vec2(
            sin(float(i) * 2.3 + u_time * 0.1) * 0.3,
            cos(float(i) * 3.7 + u_time * 0.15) * 0.3
        );
        center += vec2(float(i) * 1.7, float(i) * 2.1);
        
        float dist = distance(blotUv, center);
        float size = 0.3 + sin(float(i) * 4.2 + u_time * 0.2) * 0.2;
        
        blots += smoothstep(size + 0.1, size - 0.1, dist) * 0.3;
    }
    
    return clamp(blots, 0.0, 1.0);
}

// Vignette effect for old map edges
float vignette(vec2 uv) {
    vec2 centered = uv - 0.5;
    float dist = length(centered);
    return 1.0 - smoothstep(0.3, 0.8, dist);
}

// Sepia toning function
vec3 sepiaTone(vec3 color) {
    // Convert to grayscale first
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    
    // Apply sepia color transformation
    vec3 sepia = vec3(
        gray * 1.2 + 0.2,  // Red channel - warm
        gray * 1.0 + 0.1,  // Green channel - medium
        gray * 0.8         // Blue channel - cool (reduced)
    );
    
    return sepia;
}

// Parchment aging effects
vec3 ageParchment(vec3 color, vec2 uv) {
    // Base parchment color
    vec3 parchmentBase = vec3(0.95, 0.87, 0.7);
    
    // Add paper texture variation
    float paper = paperTexture(uv);
    parchmentBase *= (0.9 + paper * 0.2);
    
    // Blend original color with parchment
    return mix(parchmentBase, color, 0.7);
}

// Ink wash borders and stains
vec3 inkWash(vec3 color, vec2 uv) {
    // Border darkening
    float borderNoise = noise(uv * 20.0);
    float border = smoothstep(0.05, 0.15, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    border *= (0.8 + borderNoise * 0.4);
    
    // Ink stains
    float stains = inkBlots(uv);
    
    // Apply ink effects
    color *= (border + 0.3);
    color = mix(color, vec3(0.2, 0.15, 0.1), stains * 0.5);
    
    return color;
}

// Antique map grid lines
float mapGrid(vec2 uv) {
    vec2 grid = fract(uv * 20.0) - 0.5;
    float lines = 0.0;
    
    // Horizontal and vertical grid lines
    lines += smoothstep(-0.02, 0.02, abs(grid.x - 0.0)) * 
             (1.0 - smoothstep(0.02, 0.05, abs(grid.x)));
    lines += smoothstep(-0.02, 0.02, abs(grid.y - 0.0)) * 
             (1.0 - smoothstep(0.02, 0.05, abs(grid.y)));
    
    return lines * 0.3;
}

// Weathering and age spots
float weathering(vec2 uv) {
    float weather = 0.0;
    
    // Large age spots
    weather += smoothstep(0.4, 0.6, noise(uv * 5.0)) * 0.2;
    
    // Medium spots
    weather += smoothstep(0.5, 0.7, noise(uv * 15.0)) * 0.15;
    
    // Fine aging
    weather += noise(uv * 50.0) * 0.1;
    
    return weather;
}

void main() {
    vec2 uv = v_texCoord;
    
    // Sample the input texture (terrain-processed image)
    vec3 originalColor = texture2D(u_inputTexture, uv).rgb;
    
    // Start with the original color
    vec3 finalColor = originalColor;
    
    // Apply sepia toning for vintage look
    finalColor = sepiaTone(finalColor);
    
    // Age the parchment background
    finalColor = ageParchment(finalColor, uv);
    
    // Add ink wash effects and border darkening
    finalColor = inkWash(finalColor, uv);
    
    // Apply vignette for authentic map edges
    float vignetteAmount = vignette(uv);
    finalColor *= (0.6 + vignetteAmount * 0.4);
    
    // Add subtle map grid overlay
    float gridLines = mapGrid(uv);
    finalColor = mix(finalColor, vec3(0.4, 0.3, 0.2), gridLines);
    
    // Add weathering and age spots
    float weatherAmount = weathering(uv);
    finalColor = mix(finalColor, vec3(0.5, 0.4, 0.3), weatherAmount * 0.3);
    
    // Final color correction for antiqued look
    finalColor = pow(finalColor, vec3(1.1)); // Slight gamma adjustment
    finalColor *= 0.85; // Darken slightly for aged appearance
    
    gl_FragColor = vec4(finalColor, 1.0);
}