class Hotspot {
    constructor(name, indices, color) {
        this.name = name;
        this.indices = indices;
        this.color = color;
    }
}

const imageCanvas = document.getElementById('imageCanvas');
const hotspotCanvas = document.getElementById('hotspotCanvas');
const imageCtx = imageCanvas.getContext('2d');
const hotspotCtx = hotspotCanvas.getContext('2d');
const message = document.getElementById('message');
const imageLoader = document.getElementById('imageLoader');
const downloadButton = document.getElementById('downloadHotspots');
const jsonLoader = document.getElementById('jsonLoader');
const toggleDebugButton = document.getElementById('toggleDebug');
const hotspotNameDialog = document.getElementById('hotspot-name-dialog');
const hotspotNameInput = document.getElementById('hotspot-name');
const hotspotColorInput = document.getElementById('hotspot-color');
const saveHotspotButton = document.getElementById('save-hotspot');
const cancelHotspotButton = document.getElementById('cancel-hotspot');
const hotspotTooltip = document.getElementById('hotspot-tooltip');
const opacityslider = document.getElementById('opacity');
const zoomslider = document.getElementById('zoom');
const debugtext = document.getElementById('debugspan');
const modetext = document.getElementById('modespan');


let isCreateMode = true;
let editingHotspot = null;

const modeToggle = document.getElementById('mode-toggle');
const deleteHotspotButton = document.getElementById('delete-hotspot');

modeToggle.addEventListener('click', () => {
    isCreateMode = !isCreateMode;

    modetext.textContent = isCreateMode ? 'Create Mode' : 'Edit Mode';
});


let image = null;
let cellSize = 10;
let gridCols = 0;
let gridRows = 0;
let pixels = [];
let hotspots = [];
let currentHotspot = [];
let currentColor = '#fd03f9';
let defaultColor = '#fd03f9';
let isDrawing = false;
let showDebug = false;
let opacity = 0.5;
let currentzoom = 1;
let zoomLevel = 1;

let isPanning = false;
let lastPanPoint = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };

const cellSizeInput = document.getElementById('cellSize');

cellSizeInput.addEventListener('change', updateCellSize);

function updateCellSize() {
    
    const newSize = parseInt(cellSizeInput.value, 10);
    if (isNaN(newSize) || newSize < 1 || newSize > 100) {
        alert("Please enter a valid number between 1 and 100.");
        cellSizeInput.value = cellSize; // Reset to current value
        return;
    }
    
    cellSize = newSize;
    if (image) {
        createPixelGrid();
        hotspots = []; // Reset hotspots
        drawImage();
        drawHotspots();
    }
}



opacityslider.addEventListener('input', (e) => {
    opacity=event.target.value;
    if (image) {
        drawImage();
        drawHotspots();
    }
});

zoomslider.addEventListener('input', (e) => {
    zoomLevel = parseFloat(e.target.value);
    panOffset = { x: 0, y: 0 };
    drawImage();
    drawHotspots();
});


function resizeCanvas() {
    imageCanvas.width = window.innerWidth;
    imageCanvas.height = window.innerHeight;
    hotspotCanvas.width = window.innerWidth;
    hotspotCanvas.height = window.innerHeight;
    if (image) {
        drawImage();
        drawHotspots();
    }
}

function drawImage() {
    const baseScale = Math.min(imageCanvas.width / image.width, imageCanvas.height / image.height);
    const width = image.width * baseScale;
    const height = image.height * baseScale;
    const x = (imageCanvas.width - width) / 2;
    const y = (imageCanvas.height - height) / 2;
    
    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    imageCtx.save();
    imageCtx.translate(imageCanvas.width / 2, imageCanvas.height / 2);
    imageCtx.scale(zoomLevel, zoomLevel);
    imageCtx.translate(-imageCanvas.width / 2, -imageCanvas.height / 2);
    imageCtx.translate(panOffset.x / zoomLevel, panOffset.y / zoomLevel);
    imageCtx.drawImage(image, x, y, width, height);
    imageCtx.restore();
}

function createPixelGrid() {
    gridCols = Math.floor(image.width / cellSize);
    gridRows = Math.floor(image.height / cellSize);
    pixels = new Array(gridCols * gridRows).fill(0);
}

function hexToRgba(hex) {
    const bigint = parseInt(hex.replace(/^#/, ''), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function drawHotspots() {
    if (image) {
        const baseScale = Math.min(hotspotCanvas.width / image.width, hotspotCanvas.height / image.height);
        const width = image.width * baseScale;
        const height = image.height * baseScale;
        const x = (hotspotCanvas.width - width * zoomLevel) / 2 + panOffset.x;
        const y = (hotspotCanvas.height - height * zoomLevel) / 2 + panOffset.y;
        const cellWidth = (width * zoomLevel) / gridCols;
        const cellHeight = (height * zoomLevel) / gridRows;

        hotspotCtx.clearRect(0, 0, hotspotCanvas.width, hotspotCanvas.height);
        hotspotCtx.save();

        for (const hotspot of hotspots) {
            hotspotCtx.fillStyle = `${hexToRgba(hotspot.color)}`;
            for (const index of hotspot.indices) {
                const col = index % gridCols;
                const row = Math.floor(index / gridCols);
                hotspotCtx.fillRect(x + col * cellWidth, y + row * cellHeight, cellWidth, cellHeight);
            }
        }

        if (showDebug) {
            hotspotCtx.strokeStyle = 'black';
            hotspotCtx.lineWidth = 0.5;
            for (let i = 0; i <= gridCols; i++) {
                hotspotCtx.beginPath();
                hotspotCtx.moveTo(x + i * cellWidth, y);
                hotspotCtx.lineTo(x + i * cellWidth, y + height * zoomLevel);
                hotspotCtx.stroke();
            }
            for (let i = 0; i <= gridRows; i++) {
                hotspotCtx.beginPath();
                hotspotCtx.moveTo(x, y + i * cellHeight);
                hotspotCtx.lineTo(x + width * zoomLevel, y + i * cellHeight);
                hotspotCtx.stroke();
            }
        }

        hotspotCtx.restore();
    }
}

function startPanning(e) {
    isPanning = true;
    lastPanPoint = {
        x: e.clientX || e.touches[0].clientX,
        y: e.clientY || e.touches[0].clientY
    };
}

function pan(e) {
    if (!isPanning) return;

    const currentPoint = {
        x: e.clientX || e.touches[0].clientX,
        y: e.clientY || e.touches[0].clientY
    };

    const dx = currentPoint.x - lastPanPoint.x;
    const dy = currentPoint.y - lastPanPoint.y;

    panOffset.x += dx;
    panOffset.y += dy;

    lastPanPoint = currentPoint;

    drawImage();
    drawHotspots();
}

function stopPanning() {
    isPanning = false;
}

function getMousePos(canvas, evt) {
    if(image)
    {   
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

        // Calculate the position of the image within the canvas
        const baseScale = Math.min(canvas.width / image.width, canvas.height / image.height);
        const imageWidth = image.width * baseScale;
        const imageHeight = image.height * baseScale;
        const imageX = (canvas.width - imageWidth) / 2;
        const imageY = (canvas.height - imageHeight) / 2;

        // Adjust for zoom, pan, and image position
        const zoomedImageX = imageX * zoomLevel - (zoomLevel - 1) * canvas.width / 2 + panOffset.x;
        const zoomedImageY = imageY * zoomLevel - (zoomLevel - 1) * canvas.height / 2 + panOffset.y;

        return {
            x: (clientX - rect.left) * scaleX - zoomedImageX,
            y: (clientY - rect.top) * scaleY - zoomedImageY
        };

    }
    
}



function getCellIndex(x, y) {
    if (image) {
        const baseScale = Math.min(hotspotCanvas.width / image.width, hotspotCanvas.height / image.height);
        const width = image.width * baseScale * zoomLevel;
        const height = image.height * baseScale * zoomLevel;
        const cellWidth = width / gridCols;
        const cellHeight = height / gridRows;

        const col = Math.floor(x / cellWidth);
        const row = Math.floor(y / cellHeight);
        
        if (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
            return row * gridCols + col;
        }
    }
    return -1;
}

hotspotCanvas.addEventListener('mousedown', (e) => {
    if(image)
    {
        if (e.button === 1) { // Middle mouse button ~~> change this to right click four touchpads
            e.preventDefault();
            startPanning(e);
        } else { // Left mouse button
            inputStarts(e);
        }
    }
    
});

hotspotCanvas.addEventListener('mousemove', (e) => {
    if(image)
    {
        if (isPanning) {
            pan(e);
        } else {
            inputMoves(e);
        }
    }
    
});

hotspotCanvas.addEventListener('mouseup', () => {
    if(image)
    {
        if (isPanning) { // Middle mouse button
            stopPanning();
        } else { // Left mouse button
            inputEnds();
        }
    }
    
});

hotspotCanvas.addEventListener('touchstart', (e) => {
    if(image)
    {
        if (e.touches.length === 2) {
            e.preventDefault();
            startPanning(e);
        } else if (e.touches.length === 1) {
            inputStarts(e);
        }
    }
    
});

hotspotCanvas.addEventListener('touchmove', (e) => {
    if(image)
    {
        if (isPanning && e.touches.length === 2) {
            pan(e);
        } else if (e.touches.length === 1 && isDrawing) {
            inputMoves(e);
        }
    }
    
});

hotspotCanvas.addEventListener('touchend', () => {
    if(image)
    {
        if (isPanning) {
            stopPanning();
        }
        else {
            inputEnds();
        }
    }
    
});

function inputStarts(e) {
    if (isPanning) return;

    cancelHotspot();

    const pos = getMousePos(hotspotCanvas, e);
    const index = getCellIndex(pos.x, pos.y);

    if (image && isCreateMode) {
        isDrawing = true;
        currentColor = defaultColor;
        if (index >= 0) {
            currentHotspot = [index];
            drawCell(index);
        }
    } else if (image && !isCreateMode) {
        editingHotspot = hotspots.find(h => h.indices.includes(index));
        if (editingHotspot) {
            hotspotNameInput.value = editingHotspot.name;
            hotspotColorInput.value = editingHotspot.color;
            deleteHotspotButton.style.display = 'inline';
            hotspotNameDialog.style.display = 'block';
        }
    }
}

function inputMoves(e) {
    if (isPanning) return;

    const pos = getMousePos(hotspotCanvas, e);
    const index = getCellIndex(pos.x, pos.y);

    if (isCreateMode && isDrawing && index >= 0 && !currentHotspot.includes(index)) {
        currentHotspot.push(index);
        drawCell(index);
    }

    // Update tooltip
    updateHotspotTooltip(e, index);
}

function updateHotspotTooltip(e, index) {
    const hotspot = hotspots.find(h => h.indices.includes(index));
    if (hotspot) {
        hotspotTooltip.textContent = hotspot.name;
        const rect = hotspotCanvas.getBoundingClientRect();
        hotspotTooltip.style.left = `${e.clientX - rect.left + 10}px`;
        hotspotTooltip.style.top = `${e.clientY - rect.top + 10}px`;
        hotspotTooltip.style.display = 'block';
    } else {
        hotspotTooltip.style.display = 'none';
    }
}

function inputEnds()
{
    if (isPanning) return;

    if (isCreateMode && isDrawing) {
        isDrawing = false;
        hotspotNameDialog.style.display = 'block';
        deleteHotspotButton.style.display = 'none';
    }
}

// Add this function at the beginning of the script
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Add this function to load image from URL
function loadImageFromUrl(url) {
    image = new Image();
    image.crossOrigin = "Anonymous";  // This enables CORS
    image.onload = () => {
        message.style.display = 'none';
        createPixelGrid();
        resizeCanvas();
        zoomLevel = 1;
        zoomslider.value = 1;
        drawImage();
        drawHotspots();
    };
    image.onerror = () => {
        console.warn("Failed to load image from URL:", url);
    };
    image.src = url;
}

// Add this function to load hotspots from URL
function loadHotspotsFromUrl(url) {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            cellSize = data.cellSize;
            cellSizeInput.value = data.cellSize;
            hotspots = data.hotspots.map(h => new Hotspot(h.name, h.indices, h.color));
            if (image) {
                createPixelGrid();
                drawHotspots();
            }
            isCreateMode = false;
            modespan.textContent = 'Edit Mode';
        })
        .catch(error => {
            console.warn("Failed to load hotspots from URL:", url, error);
        });
}

 // Prevent context menu on right-click
 hotspotCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

hotspotCanvas.addEventListener('mouseleave', () => {
    hotspotTooltip.style.display = 'none';
});

document.addEventListener('mouseup', stopPanning);
document.addEventListener('touchend', stopPanning);

function drawCell(index) {
    const baseScale = Math.min(hotspotCanvas.width / image.width, hotspotCanvas.height / image.height);
    const width = image.width * baseScale;
    const height = image.height * baseScale;
    const x = (hotspotCanvas.width - width * zoomLevel) / 2+ panOffset.x;
    const y = (hotspotCanvas.height - height * zoomLevel) / 2+ panOffset.y;
    const cellWidth = (width * zoomLevel) / gridCols;
    const cellHeight = (height * zoomLevel) / gridRows;
    const col = index % gridCols;
    const row = Math.floor(index / gridCols);

    hotspotCtx.fillStyle = `${hexToRgba(currentColor)}`;
    hotspotCtx.fillRect(x + col * cellWidth, y + row * cellHeight, cellWidth, cellHeight);
}

saveHotspotButton.addEventListener('click', () => {
    const name = hotspotNameInput.value.trim();
    if (name) {
        if (editingHotspot) {
            editingHotspot.name = name;
            editingHotspot.color = hotspotColorInput.value;
        } else {
            hotspots.push(new Hotspot(name, currentHotspot, hotspotColorInput.value));
        }
        hotspotNameDialog.style.display = 'none';
        hotspotNameInput.value = '';
        deleteHotspotButton.style.display = 'none';
        editingHotspot = null;
        drawHotspots();
    }
});

function cancelHotspot() {
    hotspotNameDialog.style.display = 'none';
    hotspotNameInput.value = '';
    deleteHotspotButton.style.display = 'none';
    currentHotspot = [];
    editingHotspot = null;
    drawHotspots();
}

cancelHotspotButton.addEventListener('click', cancelHotspot);

deleteHotspotButton.addEventListener('click', () => {
    if (editingHotspot) {
        hotspots = hotspots.filter(h => h !== editingHotspot);
        cancelHotspot();
    }
});

imageLoader.addEventListener('change', (e) => {
    // const file = e.target.files[0];
    // if (file) {
    //     const reader = new FileReader();
    //     reader.onload = (event) => {
    //         image = new Image();
    //         image.onload = () => {
    //             message.style.display = 'none';
    //             createPixelGrid();
    //             resizeCanvas();
    //             zoomLevel = 1;
    //             zoomslider.value = 1;
    //             drawImage();
    //             drawHotspots();
    //         };
    //         image.src = event.target.result;
    //     };
    //     reader.readAsDataURL(file);
    // }
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            loadImageFromUrl(event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

downloadButton.addEventListener('click', () => {
    if (image) {
        const data = {
            cellSize: cellSize,
            imageName: imageLoader.files[0].name,
            hotspots: hotspots
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hotspots.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});

jsonLoader.addEventListener('change', (e) => {
    // const file = e.target.files[0];
    // if (file) {
    //     const reader = new FileReader();
    //     reader.onload = (event) => {
    //         const data = JSON.parse(event.target.result);
    //         cellSize = data.cellSize;
    //         cellSizeInput.value=data.cellSize;
    //         hotspots = data.hotspots.map(h => new Hotspot(h.name, h.indices, h.color));
    //         if (image) {
    //             createPixelGrid();
    //             drawHotspots();
    //         }
    //         isCreateMode = false;
    //         modespan.textContent = 'Edit Mode';
    //     };
    //     reader.readAsText(file);
    // }

    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                cellSize = data.cellSize;
                cellSizeInput.value = data.cellSize;
                hotspots = data.hotspots.map(h => new Hotspot(h.name, h.indices, h.color));
                if (image) {
                    createPixelGrid();
                    drawHotspots();
                }
                isCreateMode = false;
                modespan.textContent = 'Edit Mode';
            } catch (error) {
                console.warn("Failed to parse hotspots JSON:", error);
            }
        };
        reader.readAsText(file);
    }
});

toggleDebugButton.addEventListener('click', () => {
    showDebug = !showDebug;
    debugtext.textContent=showDebug?"Debug ON":"Debug OFF";
    if (image) {
        drawHotspots();
    }
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

document.addEventListener('DOMContentLoaded', () => {
    const imageUrl = getUrlParameter('image');
    const hotspotsUrl = getUrlParameter('hotspots');

    if (imageUrl) {
        loadImageFromUrl(imageUrl);
    }

    if (hotspotsUrl) {
        loadHotspotsFromUrl(hotspotsUrl);
    }
});

// Method for converting hotspot coordinates to UV coordinates
function hotspotToUV(hotspot) {
    return hotspot.indices.map(index => {
        const col = index % gridCols;
        const row = Math.floor(index / gridCols);
        return {
            u: col / (gridCols - 1),
            v: 1 - (row / (gridRows - 1)) // Invert V coordinate for 3D space
        };
    });
}