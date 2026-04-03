# Cartographize - Satellite Terrain Segmentation

An advanced WebGL application that automatically analyzes and segments satellite images from Google Maps to identify and color-code different geographical terrain types.

## Features

- **🛰️ Satellite Image Processing**: Upload Google Maps satellite screenshots for automatic terrain analysis
- **🎨 Terrain Segmentation**: AI-powered classification of geographical features:
  - **💧 Water/Rivers/Lakes** → Blue 
  - **🌲 Forests/Meadows** → Green
  - **🏙️ Cities/Towns** → Gray  
  - **⛰️ Mountains** → Brown
  - **🏜️ Deserts** → Yellow
- **🔄 Multiple View Modes**: 
  - Original satellite image
  - Full terrain segmentation
  - Overlay mode (blend original + segmented)
- **⚙️ Adjustable Sensitivity**: Fine-tune detection algorithms
- **🖥️ WebGL Rendering**: Hardware-accelerated real-time processing
- **📱 Responsive Design**: Works on desktop and mobile devices

## How It Works

### Terrain Classification Algorithm

The application uses computer vision techniques to analyze pixel colors and classify terrain:

1. **Water Detection**: Identifies blue-dominant pixels, often darker areas typical of water bodies
2. **Vegetation Analysis**: Detects green-dominant areas characteristic of forests and grasslands  
3. **Urban Recognition**: Finds uniform gray/concrete colors typical of cities and infrastructure
4. **Mountain Identification**: Analyzes brown/gray mixed tones common in mountainous terrain
5. **Desert Classification**: Detects yellowish sandy colors with high red-green values

### Processing Pipeline

1. Image upload and WebGL texture creation
2. Pixel-by-pixel analysis using terrain classification heuristics
3. Real-time color mapping to standardized terrain colors
4. WebGL shader-based rendering with multiple viewing modes

## Files Structure

- `index.html` - Main HTML interface with controls and canvas
- `webgl-app.js` - Core terrain segmentation and WebGL rendering engine  
- `style.css` - Modern terrain-themed styling and responsive design
- `README.md` - This documentation

## How to Use

1. **Upload**: Open `index.html` and click "Upload Satellite Image"
2. **Select**: Choose a Google Maps satellite screenshot (PNG, JPG, etc.)
3. **Process**: Click "Process Image" to run terrain segmentation
4. **Explore**: Switch between viewing modes:
   - **Original**: View the unprocessed satellite image
   - **Segmented**: See the color-coded terrain classification  
   - **Overlay**: Blend both views for comparison
5. **Adjust**: Use the sensitivity slider to fine-tune detection accuracy

## Technical Implementation

### WebGL Shaders
- **Vertex Shader**: Handles quad geometry and texture coordinates
- **Fragment Shader**: Multi-mode rendering with terrain color mapping
- **Dual Texture Support**: Simultaneous original and segmented texture binding

### Image Processing Engine  
- **Canvas 2D Integration**: Pixel-level analysis and manipulation
- **Real-time Classification**: Heuristic-based terrain identification algorithms
- **Color Space Analysis**: RGB value assessment for feature detection

### Performance Optimization
- **GPU Acceleration**: WebGL hardware rendering
- **Efficient Memory Management**: Texture recycling and cleanup
- **Responsive Processing**: Automatic image scaling for optimal performance

### Browser Requirements
- Modern browser with WebGL 1.0 support (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Sufficient memory for image processing (depends on image size)

### Supported Image Formats
- **Satellite Images**: Google Maps screenshots work best
- **File Types**: PNG, JPG, JPEG, GIF, BMP, WebP
- **Optimal Size**: 800x600 to 2048x2048 pixels for best performance
- **Automatic Scaling**: Large images are scaled to maintain performance

## Algorithm Details

### Terrain Detection Heuristics

The classification system uses color analysis with configurable sensitivity:

```javascript
// Water Detection
if (blue > red * 1.1 && blue > green && blue > 60) → Water

// Forest Detection  
if (green > red * 1.1 * sensitivity && green > blue && green > 40) → Forest

// Desert Detection
if (red > 120 && green > 100 && blue < 80 && yellowish_tone) → Desert

// Urban Detection
if (similar_RGB_values && brightness > threshold) → City

// Mountain Detection (default for unclassified terrain)
```

### Color Mapping
- 🌊 **Water**: RGB(74, 144, 226) - Ocean Blue
- 🌲 **Forest**: RGB(126, 211, 33) - Forest Green  
- 🏙️ **City**: RGB(155, 155, 155) - Urban Gray
- ⛰️ **Mountain**: RGB(139, 69, 19) - Earth Brown
- 🏜️ **Desert**: RGB(245, 166, 35) - Sand Yellow

## Performance Notes

- **Image Size**: Larger images take longer to process but provide more detail
- **Sensitivity**: Higher values detect more features but may cause false positives
- **Browser**: Chrome and Firefox typically offer the best WebGL performance
- **Hardware**: GPU acceleration significantly improves rendering speed

## Browser Compatibility

**Full Support:**
- Chrome 56+ (recommended)
- Firefox 51+
- Safari 11+
- Edge 79+

## Running the Application

1. **Local File**: Simply open `index.html` in your browser
2. **Local Server**: For enhanced security, serve via HTTP:
   ```bash
   python -m http.server 8000
   # Navigate to http://localhost:8000
   ```
### Advanced Algorithms
- Texture analysis for improved mountain detection
- Edge detection for precise boundary identification  
- Multi-scale analysis for handling various zoom levels
- Contextual classification using neighboring pixels
