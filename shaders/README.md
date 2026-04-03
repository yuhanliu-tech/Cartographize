# Cartographize - Shader Files

This folder contains the WebGL shader files used for the fantasy terrain map effects.

## Files

- **vertex.glsl** - Vertex shader that handles vertex positioning and texture coordinates
- **fragment.glsl** - Fragment shader containing all the procedural terrain patterns:
  - Water wave animations
  - Mountain ridge textures  
  - Forest leaf patterns
  - City building grids with glowing windows
  - Desert sand dunes
- **postprocess.glsl** - Post-processing fragment shader for vintage map effects:
  - Sepia toning and aging
  - Parchment paper texture
  - Ink wash borders and stains
  - Vignette effects for old map edges
  - Animated ink blots and weathering
  - Antique map grid overlay

## Rendering Pipeline

The application uses a dual-pass rendering system:
1. **Pass 1**: Terrain effects are rendered to a framebuffer using `fragment.glsl`
2. **Pass 2**: The framebuffer is post-processed with vintage effects using `postprocess.glsl` and rendered to the canvas

## Usage

These shaders are automatically loaded by the main application via fetch requests when the WebGL context is initialized. If external loading fails, fallback inline versions are used.

## Editing

To modify the visual effects:
1. Edit the appropriate shader file
2. Reload the webpage to see changes
3. Check browser console for any shader compilation errors