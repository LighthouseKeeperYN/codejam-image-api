
import '../sass/main.scss';
import '@babel/polyfill';

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

let currentImg = localStorage.getItem('imgData');
let pixelSize = 2;
let selectedTool = localStorage.getItem('selectedTool') || 'pencil';
let isDrawing = false;
let isImageLoaded = localStorage.getItem('isImageLoaded');

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

const tools = {
  pencilButton: document.getElementById('pencil'),
  bucketButton: document.getElementById('bucket'),
  colorPickerButton: document.getElementById('color-picker'),
};

const color = {
  curr: JSON.parse(localStorage.getItem('color-curr')) || [0, 128, 0],
  prev: JSON.parse(localStorage.getItem('color-prev')) || [255, 255, 255],
  a: JSON.parse(localStorage.getItem('color-a')) || [0, 0, 128],
  b: JSON.parse(localStorage.getItem('color-b')) || [128, 0, 0],
};

const colorButton = {
  curr: document.getElementById('color-curr'),
  prev: document.getElementById('color-prev'),
  a: document.getElementById('color-a'),
  b: document.getElementById('color-b'),
};

clearCanvas();

// ++++++++++ UTILITIES ++++++++++

function clearCanvas() {
  ctx.fillStyle = '#e5e5e5';
  ctx.fillRect(0, 0, canvas.width, canvas.clientWidth);
  ctx.fillStyle = color.curr;
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

function colorToString(clr) {
  return `rgba(${clr[0]},${clr[1]},${clr[2]},${clr[3] ? (clr[3] / 255) : 1})`;
}

function scaleDown(coordinate) {
  return Math.floor(coordinate / pixelSize);
}

function toPixel(coordinate) {
  return Math.floor(coordinate / pixelSize) * pixelSize;
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
  const imageData = ctx.getImageData(0, 0, 512, 512);
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

function pencil() {
  drawLine(
    scaleDown(cursor.last.x),
    scaleDown(cursor.last.y),
    scaleDown(cursor.curr.x),
    scaleDown(cursor.curr.y),
  );
}

function fill(startX, startY) {
  const imgData = ctx.getImageData(0, 0, 512, 512);
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
    imgData.data[pixelPos] = color.curr[0];
    imgData.data[pixelPos + 1] = color.curr[1];
    imgData.data[pixelPos + 2] = color.curr[2];
    imgData.data[pixelPos + 3] = 255;
  }

  if (startColor[0] === color.curr[0]
    && startColor[1] === color.curr[1]
    && startColor[2] === color.curr[2]
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

function colorPicker(x, y) {
  const pxData = ctx.getImageData(x, y, 1, 1).data.slice(0, -1);
  colorButton.curr.parentElement.style.backgroundColor = colorToString(pxData);
  colorButton.prev.parentElement.style.backgroundColor = colorToString(color.curr);
  color.prev = color.curr;
  color.curr = pxData;
}

// ++++++++++ TOOLS AND COLORS GUI ++++++++++

function selectTool(tl) {
  Object.values(tools).forEach((button) => {
    button.classList.remove('tool-item--selected');
  });

  selectedTool = tl.id;
  tl.classList.add('tool-item--selected');
}

Object.values(tools).forEach((tool) => {
  if (tool.id === selectedTool) tool.classList.add('tool-item--selected');

  tool.addEventListener('click', () => {
    selectTool(tool);
  });
});

document.addEventListener('keypress', (e) => {
  if (e.code === 'KeyP') {
    selectTool(tools.pencilButton);
  }
  if (e.code === 'KeyB') {
    selectTool(tools.bucketButton);
  }
  if (e.code === 'KeyC') {
    selectTool(tools.colorPickerButton);
  }
});

Object.keys(colorButton).forEach((name) => {
  colorButton[name].parentElement.style.backgroundColor = colorToString(color[name]);
  colorButton[name].value = rgbToHex(color[name]);
});

Object.values(colorButton).forEach((button) => {
  button.addEventListener('change', (e) => {
    e.target.parentElement.style.backgroundColor = e.target.value;
    if (e.target.id === 'color-curr') {
      colorButton.prev.parentElement.style.backgroundColor = rgbToHex(color.curr);
      color.curr = hexToRGB(e.target.value);
    }
    if (e.target.id === 'color-a') {
      color.a = hexToRGB(e.target.value);
    }
    if (e.target.id === 'color-b') {
      color.b = hexToRGB(e.target.value);
    }
  });

  button.parentElement.parentElement.addEventListener('click', (e) => {
    if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
      colorButton.prev.parentElement.style.backgroundColor = colorToString(color.curr);

      if (e.currentTarget.children[0].children[0].id === 'color-prev') {
        colorButton.curr.parentElement.style.backgroundColor = colorToString(color.prev);
        [color.prev, color.curr] = [color.curr, color.prev];
      }
      if (e.currentTarget.children[0].children[0].id === 'color-a') {
        colorButton.curr.parentElement.style.backgroundColor = colorToString(color.a);
        color.prev = color.curr;
        color.curr = color.a;
      }
      if (e.currentTarget.children[0].children[0].id === 'color-b') {
        colorButton.curr.parentElement.style.backgroundColor = colorToString(color.b);
        color.prev = color.curr;
        color.curr = color.b;
      }
    }
  });
});

// ++++++++++ CANVAS EVENTS ++++++++++

canvas.addEventListener('mousedown', (e) => {
  if (selectedTool === 'pencil') {
    ctx.fillStyle = colorToString(color.curr);
    isDrawing = true;

    cursor.last.x = e.layerX;
    cursor.last.y = e.layerY;

    ctx.fillRect(toPixel(e.layerX), toPixel(e.layerY), pixelSize, pixelSize);
  }
  if (selectedTool === 'bucket') {
    ctx.fillStyle = colorToString(color.curr);

    fill(e.layerX, e.layerY);

    currentImg = canvas.toDataURL();
  }
  if (selectedTool === 'color-picker') {
    colorPicker(e.layerX, e.layerY);
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (selectedTool === 'pencil' && isDrawing) {
    cursor.curr.x = e.layerX;
    cursor.curr.y = e.layerY;

    pencil();

    cursor.last.x = cursor.curr.x;
    cursor.last.y = cursor.curr.y;
  }
});

document.addEventListener('mouseup', () => {
  if (selectedTool === 'pencil' && isDrawing) {
    isDrawing = false;

    currentImg = canvas.toDataURL();
  }
});

// ++++++++++ CANVAS GUI ++++++++++

const rangeSlider = document.querySelector('.range-slider');
const rangeSliderPointer = rangeSlider.previousElementSibling;
rangeSlider.value = localStorage.getItem('rangeSliderValue') || '2';

moveSlider();
resizeImg();

rangeSlider.addEventListener('input', () => {
  moveSlider();
  resizeImg();
});

function moveSlider() {
  const stepDistance = (rangeSlider.offsetWidth - 50) / rangeSlider.max;
  rangeSliderPointer.style.left = `${stepDistance * rangeSlider.value}px`;

  if (rangeSlider.value === '0') {
    rangeSliderPointer.innerHTML = 128;
  }
  if (rangeSlider.value === '1') {
    rangeSliderPointer.innerHTML = 256;
  }
  if (rangeSlider.value === '2') {
    rangeSliderPointer.innerHTML = 512;
  }
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

window.onbeforeunload = () => {
  localStorage.setItem('imgData', canvas.toDataURL());
  localStorage.setItem('color-curr', JSON.stringify(color.curr));
  localStorage.setItem('color-prev', JSON.stringify(color.prev));
  localStorage.setItem('color-a', JSON.stringify(color.a));
  localStorage.setItem('color-b', JSON.stringify(color.b));
  localStorage.setItem('selectedTool', selectedTool);
  localStorage.setItem('rangeSliderValue', rangeSlider.value);
  localStorage.setItem('isImageLoaded', isImageLoaded);
};
