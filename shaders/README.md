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

## Usage

These shaders are automatically loaded by the main application via fetch requests when the WebGL context is initialized.

## Editing

To modify the visual effects:
1. Edit the appropriate shader file
2. Reload the webpage to see changes
3. Check browser console for any shader compilation errors