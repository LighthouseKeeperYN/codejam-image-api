import '../sass/main.scss';
import '@babel/polyfill';

const canvasFieldSize = 512;

const cursor = {
  curr: {
    x: 0,
    y: 0,
  },
  last: {
    x: 0,
    y: 0,
  },
};

const toolsIDs = {
  pencil: 'pencil',
  bucket: 'bucket',
  colorPicker: 'color-picker',
};

const tools = {
  pencilButton: document.getElementById(toolsIDs.pencil),
  bucketButton: document.getElementById(toolsIDs.bucket),
  colorPickerButton: document.getElementById(toolsIDs.colorPicker),
};

const colorButtonsIDs = {
  colorCurr: 'color-curr',
  colorPrev: 'color-prev',
  colorA: 'color-a',
  colorB: 'color-b',
};

const colorButtons = {
  curr: document.getElementById(colorButtonsIDs.colorCurr),
  prev: document.getElementById(colorButtonsIDs.colorPrev),
  a: document.getElementById(colorButtonsIDs.colorA),
  b: document.getElementById(colorButtonsIDs.colorB),
};

const colors = {
  curr: JSON.parse(localStorage.getItem(colorButtonsIDs.colorCurr)) || [0, 128, 0],
  prev: JSON.parse(localStorage.getItem(colorButtonsIDs.colorPrev)) || [255, 255, 255],
  a: JSON.parse(localStorage.getItem(colorButtonsIDs.colorA)) || [0, 0, 128],
  b: JSON.parse(localStorage.getItem(colorButtonsIDs.colorB)) || [128, 0, 0],
  canvas: '#e5e5e5',
};

const shortCuts = {
  pencil: 'KeyP',
  bucket: 'KeyB',
  colorPicker: 'KeyC',
};

const canvas = document.querySelector('.canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
if (localStorage.getItem('imgData')) {
  const img = new Image();
  img.src = localStorage.getItem('imgData');
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
  };
}

const canvasArea = document.querySelector('.canvas-area');
const searchField = document.getElementById('search-field');

let pixelSize = 1;
let currentImg = localStorage.getItem('imgData');
let selectedTool = localStorage.getItem('selectedTool') || toolsIDs.pencil;
let isImageLoaded = localStorage.getItem('isImageLoaded');
let isDrawing = false;

clearCanvas();

// ++++++++++ UTILITIES ++++++++++

function clearCanvas() {
  ctx.fillStyle = colors.canvas;
  ctx.fillRect(0, 0, canvas.width, canvas.clientWidth);
  ctx.fillStyle = colors.curr;
}

function hexToRGB(hex) {
  const m = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  return [
    parseInt(m[1], 16),
    parseInt(m[2], 16),
    parseInt(m[3], 16),
  ];
}

function rgbToHex(rgb) {
  return `#${((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1)}`;
}

function colorToString(colorsArray) {
  return `rgba(${colorsArray[0]},${colorsArray[1]},${colorsArray[2]},${colorsArray[3] ? (colorsArray[3] / 255) : 1})`;
}

function scaleDown(coordinate, ratio) {
  return Math.floor(coordinate / ratio);
}

function coordinateToPixel(coordinate, ratio) {
  return Math.floor(coordinate / ratio) * ratio;
}

function drawLine(x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;

  const dy = Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;

  let err = (dx > dy ? dx : -dy) / 2;

  while (true) {
    ctx.fillRect((x0 * pixelSize), (y0 * pixelSize), pixelSize, pixelSize);

    if (x0 === x1 && y0 === y1) break;
    const e2 = err;
    if (e2 > -dx) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dy) {
      err += dx;
      y0 += sy;
    }
  }
}

function toGreyScale() {
  const imageData = ctx.getImageData(0, 0, canvasFieldSize, canvasFieldSize);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = avg;
    data[i + 1] = avg;
    data[i + 2] = avg;
  }

  ctx.putImageData(imageData, 0, 0);
  currentImg = canvas.toDataURL();
}

function renderImg(src, save) {
  const img = new Image();
  img.src = src;
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    clearCanvas();

    ctx.scale(1 / pixelSize, 1 / pixelSize);

    const hRatio = canvas.width / img.width;
    const vRatio = canvas.height / img.height;
    const ratio = Math.min(hRatio, vRatio);
    const centerShiftX = (canvas.width - img.width * ratio) / 2;
    const centerShiftY = (canvas.height - img.height * ratio) / 2;

    ctx.drawImage(img, 0, 0, img.width, img.height,
      centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);

    ctx.globalCompositeOperation = 'copy';

    ctx.setTransform(pixelSize, 0, 0, pixelSize, 0, 0);
    ctx.drawImage(canvas, 0, 0);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    if (save) currentImg = canvas.toDataURL();
  };
}

async function loadImg() {
  const town = searchField.value;
  const accessKey = 'e1b2fa57a6eab7a1988ecf8c8cc9f31f3d835c93ea82f1693e23ed48fae13808';
  const url = `https://api.unsplash.com/photos/random?query=town,${town}&client_id=${accessKey}`;

  const res = await fetch(url);
  const data = await res.json();

  renderImg(data.urls.small, true);
}

// ++++++++++ TOOLS ++++++++++

function usePencil() {
  drawLine(
    scaleDown(cursor.last.x, pixelSize),
    scaleDown(cursor.last.y, pixelSize),
    scaleDown(cursor.curr.x, pixelSize),
    scaleDown(cursor.curr.y, pixelSize),
  );
}

function useBucket(startX, startY) {
  const imgData = ctx.getImageData(0, 0, canvasFieldSize, canvasFieldSize);
  const startColor = ctx.getImageData(startX, startY, 1, 1).data;
  const startR = startColor[0];
  const startG = startColor[1];
  const startB = startColor[2];

  const pixelStack = [[startX, startY]];

  function matchStartColor(pixelPos) {
    const r = imgData.data[pixelPos];
    const g = imgData.data[pixelPos + 1];
    const b = imgData.data[pixelPos + 2];

    return (r === startR && g === startG && b === startB);
  }

  function paintPixel(pixelPos) {
    imgData.data[pixelPos] = colors.curr[0];
    imgData.data[pixelPos + 1] = colors.curr[1];
    imgData.data[pixelPos + 2] = colors.curr[2];
    imgData.data[pixelPos + 3] = 255;
  }

  if (startColor[0] === colors.curr[0]
    && startColor[1] === colors.curr[1]
    && startColor[2] === colors.curr[2]
  ) return;

  while (pixelStack.length) {
    const newPos = pixelStack.pop();
    const x = newPos[0];
    let y = newPos[1];
    let leftMarked = false;
    let rightMarked = false;

    let pixelPos = (y * canvas.width + x) * 4;

    while (y-- >= 0 && matchStartColor(pixelPos)) {
      pixelPos -= canvas.width * 4;
    }

    pixelPos += canvas.width * 4;
    y++;

    while (y++ <= canvas.width && matchStartColor(pixelPos)) {
      paintPixel(pixelPos);

      if (x > 0) {
        if (matchStartColor(pixelPos - 4)) {
          if (!leftMarked) {
            pixelStack.push([x - 1, y]);
            leftMarked = true;
          }
        } else if (leftMarked) {
          leftMarked = false;
        }
      }

      if (x <= canvas.width) {
        if (matchStartColor(pixelPos + 4)) {
          if (!rightMarked) {
            pixelStack.push([x + 1, y]);
            rightMarked = true;
          }
        } else if (rightMarked) {
          rightMarked = false;
        }
      }

      pixelPos += canvas.width * 4;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function useColorPicker(x, y) {
  const pxData = ctx.getImageData(x, y, 1, 1).data.slice(0, -1);
  colorButtons.curr.parentElement.style.backgroundColor = colorToString(pxData);
  colorButtons.prev.parentElement.style.backgroundColor = colorToString(colors.curr);
  colors.prev = colors.curr;
  colors.curr = pxData;
}

// ++++++++++ TOOLS AND COLORS GUI ++++++++++

function selectTool(tool) {
  Object.values(tools).forEach((button) => {
    button.classList.remove('tool-item--selected');
  });

  selectedTool = tool.id;
  tool.classList.add('tool-item--selected');
}

Object.values(tools).forEach((tool) => {
  if (tool.id === selectedTool) tool.classList.add('tool-item--selected');

  tool.addEventListener('click', () => {
    selectTool(tool);
  });
});

document.addEventListener('keypress', (e) => {
  switch (e.code) {
    case shortCuts.pencil: {
      selectTool(tools.pencilButton);
      break;
    }
    case shortCuts.bucket: {
      selectTool(tools.bucketButton);
      break;
    }
    case shortCuts.colorPicker: {
      selectTool(tools.colorPickerButton);
      break;
    }
    default:
  }
});

Object.keys(colorButtons).forEach((name) => {
  colorButtons[name].parentElement.style.backgroundColor = colorToString(colors[name]);
  colorButtons[name].value = rgbToHex(colors[name]);
});

Object.values(colorButtons).forEach((button) => {
  button.addEventListener('change', (e) => {
    e.target.parentElement.style.backgroundColor = e.target.value;
    if (e.target.id === colorButtonsIDs.colorCurr) {
      colorButtons.prev.parentElement.style.backgroundColor = rgbToHex(colors.curr);
      colors.curr = hexToRGB(e.target.value);
    }
    if (e.target.id === colorButtonsIDs.colorA) {
      colors.a = hexToRGB(e.target.value);
    }
    if (e.target.id === colorButtonsIDs.colorB) {
      colors.b = hexToRGB(e.target.value);
    }
  });

  button.parentElement.parentElement.addEventListener('click', (e) => {
    if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
      colorButtons.prev.parentElement.style.backgroundColor = colorToString(colors.curr);

      if (e.currentTarget.children[0].children[0].id === colorButtonsIDs.colorPrev) {
        colorButtons.curr.parentElement.style.backgroundColor = colorToString(colors.prev);
        [colors.prev, colors.curr] = [colors.curr, colors.prev];
      }
      if (e.currentTarget.children[0].children[0].id === colorButtonsIDs.colorA) {
        colorButtons.curr.parentElement.style.backgroundColor = colorToString(colors.a);
        colors.prev = colors.curr;
        colors.curr = colors.a;
      }
      if (e.currentTarget.children[0].children[0].id === colorButtonsIDs.colorB) {
        colorButtons.curr.parentElement.style.backgroundColor = colorToString(colors.b);
        colors.prev = colors.curr;
        colors.curr = colors.b;
      }
    }
  });
});

// ++++++++++ CANVAS EVENTS ++++++++++

canvas.addEventListener('mousedown', (e) => {
  if (selectedTool === toolsIDs.pencil) {
    ctx.fillStyle = colorToString(colors.curr);
    isDrawing = true;

    cursor.last.x = e.layerX;
    cursor.last.y = e.layerY;

    ctx.fillRect(
      coordinateToPixel(e.layerX, pixelSize),
      coordinateToPixel(e.layerY, pixelSize), pixelSize, pixelSize,
    );
  }
  if (selectedTool === toolsIDs.bucket) {
    ctx.fillStyle = colorToString(colors.curr);

    useBucket(e.layerX, e.layerY);

    currentImg = canvas.toDataURL();
  }
  if (selectedTool === toolsIDs.colorPicker) {
    useColorPicker(e.layerX, e.layerY);
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (selectedTool === toolsIDs.pencil && isDrawing) {
    cursor.curr.x = e.layerX;
    cursor.curr.y = e.layerY;

    usePencil();

    cursor.last.x = cursor.curr.x;
    cursor.last.y = cursor.curr.y;
  }
});

document.addEventListener('mouseup', () => {
  if (selectedTool === toolsIDs.pencil && isDrawing) {
    isDrawing = false;

    currentImg = canvas.toDataURL();
  }
});

// ++++++++++ CANVAS GUI ++++++++++

const rangeSlider = document.querySelector('.range-slider');
const rangeSliderPointer = rangeSlider.previousElementSibling;
rangeSlider.value = localStorage.getItem('rangeSliderValue') || '2';

resizeImg();
moveSlider();


rangeSlider.addEventListener('input', () => {
  resizeImg();
  moveSlider();
});

function moveSlider() {
  const stepDistance = (rangeSlider.offsetWidth - 50) / rangeSlider.max;
  rangeSliderPointer.style.left = `${stepDistance * rangeSlider.value}px`;

  rangeSliderPointer.innerHTML = canvasFieldSize / pixelSize;
}

function resizeImg() {
  if (rangeSlider.value === '0') {
    pixelSize = 4;
    renderImg(currentImg);
  }
  if (rangeSlider.value === '1') {
    pixelSize = 2;
    renderImg(currentImg);
  }
  if (rangeSlider.value === '2') {
    pixelSize = 1;
    renderImg(currentImg);
  }
}

canvasArea.addEventListener('mousedown', (e) => {
  if (e.target.classList.contains('btn-square')) {
    e.target.style.transform = 'translate(1px, 2px)';
  }
});

canvasArea.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-square')) {
    e.target.style.transform = 'translate(0, 0)';
  }
  if (e.target.id === 'btn-load') {
    loadImg();
    isImageLoaded = true;
  }
  if (e.target.id === 'btn-bw') {
    if (!isImageLoaded || isImageLoaded === 'null') {
      alert('Please load the image first');
    } else toGreyScale();
  }
});

// ++++++++++ GITHUB OAUTH ++++++++++

const firebaseConfig = {
  apiKey: 'AIzaSyBeoD9IqsVhQVRdeEaT1n467YdhkYzCDn4',
  authDomain: 'image-api-lskeeper.firebaseapp.com',
  databaseURL: 'https://image-api-lskeeper.firebaseio.com',
  projectId: 'image-api-lskeeper',
  storageBucket: 'image-api-lskeeper.appspot.com',
  messagingSenderId: '784369560587',
  appId: '1:784369560587:web:00f38e79b696c9ccafab0e',
  measurementId: 'G-DNFXHF0P56',
};

firebase.initializeApp(firebaseConfig);

const provider = new firebase.auth.GithubAuthProvider();
provider.setCustomParameters({
  allow_signup: 'true',
});

function GitHubAuthRedirect() {
  firebase.auth().signInWithRedirect(provider);
}

function getGitHubAuthResponse() {
  firebase.auth().getRedirectResult().then((result) => {
    if (result.credential) {
      const userName = result.additionalUserInfo.username;
      authBtn.previousElementSibling.innerText = userName;
      authBtn.remove();
    }
  }).catch(() => { });
}

getGitHubAuthResponse();

const authBtn = document.getElementById('btn-auth');
authBtn.addEventListener('mousedown', (e) => {
  e.target.style.transform = 'translate(1px, 2px)';
});
authBtn.addEventListener('click', () => {
  GitHubAuthRedirect();
});

// ++++++++++ STORAGE ++++++++++

window.onbeforeunload = function uploadToLocalStorage() {
  localStorage.setItem('imgData', canvas.toDataURL());
  localStorage.setItem(colorButtonsIDs.colorCurr, JSON.stringify(colors.curr));
  localStorage.setItem(colorButtonsIDs.colorPrev, JSON.stringify(colors.prev));
  localStorage.setItem(colorButtonsIDs.colorA, JSON.stringify(colors.a));
  localStorage.setItem(colorButtonsIDs.colorB, JSON.stringify(colors.b));
  localStorage.setItem('selectedTool', selectedTool);
  localStorage.setItem('rangeSliderValue', rangeSlider.value);
  localStorage.setItem('isImageLoaded', isImageLoaded);
};
