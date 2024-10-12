const r = document.querySelector(':root');
const body = document.querySelector('body');
const editorGlyph = document.querySelector('#editor');

// Appearance
const lightModeBtn = document.querySelector('#light-mode');
const darkModeBtn = document.querySelector('#dark-mode');

// File options
const fontNameInput = document.querySelector('#font-name');

// Bezier curve constant
const kappa = 0.5522848;
// Device pixel ratio
const dpr = window.devicePixelRatio || 1;
// SVG grid size
const gridSize = 10;

let mouseIsDown = false;
let drawMode = 1;
let currentGlyph;

const charsets = {
   "roman-uppercase": {
      "name": "Roman Uppercase",
      "slug": "roman-uppercase",
      "default": "true",
      "chars": [65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90]
   },

   "roman-lowercase": {
      "name": "Roman Lowercase",
      "slug": "roman-lowercase",
      "chars": [97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122]
   },

   "arabic-numerals": {
      "name": "Arabic Numerals",
      "slug": "arabic-numerals",
      "chars": [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58]
   },

   "basic-punctuation": {
      "name": "Basic Punctuation",
      "slug": "basic-punctuation",
      "chars": [32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 58, 59, 60, 61, 62, 63, 64, 91, 92, 93, 94, 95, 96, 123, 124, 125, 126]
   },

   // "special-symbols": {
   //    "name": "Special Symbols",
   //    "slug": "special-symbols",
   //    "chars": [169, 174, 8482, 167, 182, 8225, 8224, 8710, 8721, 8730, 8776, 8800, 8839, 8997, 9500, 9508, 9516, 9600, 9642]
   // },

   "arrows": {
      "name": "Arrows",
      "slug": "arrows",
      "chars": [8592, 8593, 8594, 8595, 8596, 8597, 8617, 8618, 8629, 8630, 8656, 8657, 8658, 8659, 8660, 8676, 8677, 8678, 8680, 8681, 8682, 8686, 8690]
   },

   "math-symbols": {
      "name": "Math Symbols",
      "slug": "math-symbols",
      "chars": [8704, 8706, 8707, 8710, 8719, 8721, 8722, 8727, 8730, 8733, 8734, 8743, 8744, 8745, 8746, 8756, 8764, 8776, 8800, 8801, 8804, 8805, 8814, 8815, 8826, 8827, 8839]
   },

   "currency-symbols": {
      "name": "Currency Symbols",
      "slug": "currency-symbols",
      "chars": [36, 164, 165, 8364, 8372, 8377, 8501, 8539, 8369, 8383, 8470]
   },

   "ligatures": {
    "name": "Ligatures",
    "slug": "ligatures",
    "chars": [64256, 64257, 64258, 64259, 64260, 64261, 64262, 64263, 64264, 64265]
  }
}

let font = {
   name: "My Dot Matrix Font",

   styles: {
      "pixelSize": 98,
      "pixelShape": 0,
      "height": 10,
      "defaultWidth": 7,
      "baseline": 2,
      "showBaseline": false,
      "tracking": 1,
      "widthLock": false,
      "theme": "dark",
   },

   glyphs: {},
   clipboards: {},
   charsets: {},

   syncStyles: () => document.dispatchEvent(new CustomEvent('sync-font-styles')),
   syncColors: () => document.dispatchEvent(new CustomEvent('sync-font-colors')),
   syncFontSize: () => document.dispatchEvent(new CustomEvent('sync-font-size')),
   syncCurrentGlyph: () => document.dispatchEvent(new CustomEvent('sync-current-glyph')),
   syncName: () => document.dispatchEvent(new CustomEvent('sync-font-name')),

   forEachGlyph(callback) {
      for (const glyph in this.glyphs) {
         callback(this.glyphs[glyph]);
      }
      for (const glyph in this.clipboards) {
         callback(this.clipboards[glyph]);
      }
   },

   setName(name) {
      // TODO add regex
      if (name == undefined) {
         return;
      }
      this.name = name;
      this.syncName();
   },

   setPixelSize(pixelSize) {
      if (0 < pixelSize) {
         this.styles.pixelSize = pixelSize;
         this.syncStyles();
      }
   },

   setTracking(tracking) {
      if (0 <= tracking && tracking <= 32) {
         this.styles.tracking = tracking;
      }
      this.syncFontSize();
   },

   setBaseline(baseline) {
      if (0 <= baseline && baseline <= this.styles.height) {
         this.styles.baseline = baseline;
         this.showBaseline();
      }
      this.syncStyles();
   },

   showBaseline() {
      this.styles.showBaseline = true;
      this.syncStyles();
   },

   hideBaseline() {
      this.styles.showBaseline = false;
      this.syncStyles();
   },

   setDefaultMatrix(height, width) {
      const heightDiff = height - this.styles.height;
      const widthDiff = width - this.styles.defaultWidth;
      this.styles.height = +height;
      this.styles.defaultWidth = +width;

      this.forEachGlyph(glyph => {
         glyph.syncTop();
         glyph.editRight(widthDiff);
      })
      this.syncFontSize();
   },

   setCurrentGlyph(codepoint) {
      if (!this.glyphs.hasOwnProperty(codepoint)) {
         console.warn(`Character ${codepoint} not found.`);
         return;
      }
      document.querySelector(`dm-type-case dm-glyph[codepoint="${currentGlyph?.codepoint}"]`)?.classList.remove('current-glyph');
      currentGlyph = this.glyphs[codepoint];
      editorGlyph.setAttribute('codepoint', currentGlyph.codepoint);
      // editorDisplay.setAttribute('codepoint', currentGlyph.codepoint);
      document.querySelector(`dm-type-case dm-glyph[codepoint="${currentGlyph.codepoint}"]`)?.classList.add('current-glyph');
      this.syncColors();
      this.syncCurrentGlyph();
   },

   sortGlyphs() {
      let firstUnsortedGlyph;

      do {
         firstUnsortedGlyph = Object.values(this.glyphs).find(glyph => glyph.unsorted === true);
         // console.log(`Sorting ${firstUnsortedGlyph}`);
         for (const charset in this.charsets) {
            if (this.charsets[charset].chars.find(glyph => glyph == firstUnsortedGlyph?.codepoint)) {
               this.charsets[charset].buildChars();
               break;
            }
         }
         
      } while (firstUnsortedGlyph);

      this.syncStyles();
      this.setCurrentGlyph(Object.keys(this.glyphs)[0]);
   },

   editTop(rows) {
      this.styles.height += rows;
      if (this.styles.height < 1) {
         this.styles.height = 1;
      }
      if (this.styles.baseline > this.height) {
         this.setBaseline(this.height);
      }
      this.syncFontSize();
      this.forEachGlyph(glyph => glyph.syncTop());
   },

   editBottom(rows) {
      this.styles.height += rows;
      this.setBaseline(this.styles.baseline + rows);
      if (this.styles.height < 1) {
         this.styles.height = 1;
      }
      this.syncFontSize();
      this.forEachGlyph(glyph => glyph.syncBottom());
   },

   editLeft(cols) {
      if (this.styles.widthLock) {
         this.styles.defaultWidth += cols;
         if (this.styles.defaultWidth < 1) {
            this.styles.defaultWidth = 1;
         }
         this.syncFontSize();
         this.forEachGlyph(glyph => glyph.editLeft(cols));
      } else {
         currentGlyph.editLeft(cols);
      }
   },

   editRight(cols) {
      if (this.styles.widthLock) {
         this.styles.defaultWidth += cols;
         if (this.styles.defaultWidth < 1) {
            this.styles.defaultWidth = 1;
         }
         this.syncFontSize();
         this.forEachGlyph(glyph => glyph.editRight(cols));
      } else {
         currentGlyph.editRight(cols);
      }
   },
}

function setTheme(color) {
   switch (color) {
      case 'dark':
         font.styles.theme = 'dark';
         r.style.colorScheme = 'dark';
         lightModeBtn.classList.remove('selected');
         darkModeBtn.classList.add('selected');
         break;
      case 'light':
      default:
         font.styles.theme = 'light';
         r.style.colorScheme = 'light';
         darkModeBtn.classList.remove('selected');
         lightModeBtn.classList.add('selected');
         break;
   }
   font.syncColors();
}

function isValidCodepoint(codepoint) {
   try {
      String.fromCodePoint(codepoint);
      return true;
   } catch (e) {
      return false;
   }
}

function checkPreferredTheme() {
   if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
   }
}

function copyToClipboard(clipboardID = 'clipboard') {
   font.clipboards[clipboardID].setMatrix(currentGlyph.matrix);
}

function pasteFromClipboard(clipboardID = 'clipboard') {
   currentGlyph.setMatrix(font.clipboards[clipboardID].matrix);
}

class Glyph {
   constructor(codepoint, sourceMatrix) {
      if (isValidCodepoint(codepoint)) {
         // Font character
         font.glyphs[codepoint] = this;
      } else if (codepoint == 'clipboard') {
         font.clipboards[codepoint] = this;
      } else {
         console.warn(`${codepoint} is not a valid codepoint`);
      }
      this.codepoint = codepoint;
      this.matrix = [];
      this.syncDisplays = () => document.dispatchEvent(new CustomEvent(`sync-${this.codepoint}-matrix`));

      if (sourceMatrix) {
         this.setMatrix(sourceMatrix);
         this.unsorted = true;
      } else {
         this.resetMatrix();
      }
   }

   // syncDisplays = () => {
   //    document.dispatchEvent(this.syncEvent);
   // }

   newRow = () => {
      return Array(this.matrix[0].length).fill(0);
   }

   setPixel = (x, y) => {
      this.matrix[y][x] = drawMode;
      const setPixelEvent = new CustomEvent(`set-${this.codepoint}-pixel`, { detail: {x: x, y: y, color: drawMode }});
      document.dispatchEvent(setPixelEvent);
   }

   setMatrix = (sourceMatrix) => {
      this.matrix.splice(0, this.matrix.length, ...sourceMatrix.map(row => [...row]));
      this.syncDisplays();
   }

   resetMatrix = () => {
      this.matrix = Array.from({ length: font.styles.height }, () => Array(font.styles.defaultWidth).fill(0));
      this.syncDisplays();
   }

   clear = () => {
      for (let y = 0; y < this.matrix.length; y++) {
         for (let x = 0; x < this.matrix[0].length; x++) {
            this.matrix[y][x] = 0;
         }
      }
      this.syncDisplays();
   }

   invert = () => {
      for (let y = 0; y < this.matrix.length; y++) {
         for (let x = 0; x < this.matrix[0].length; x++) {
            this.matrix[y][x] = 1 - this.matrix[y][x];
         }
      }
      this.syncDisplays();
   }

   syncTop() {
      const heightDiff = font.styles.height - this.matrix.length;
      if (heightDiff > 0) {
         for (let i = 0; i < heightDiff; i++) {
            this.matrix.unshift(this.newRow());
         }
      } else if (heightDiff < 0) {
         for (let i = 0; i > heightDiff; i--) {
            this.matrix.shift();
         }
      }
      this.syncDisplays();
   }

   syncBottom() {
      const heightDiff = font.styles.height - this.matrix.length;
      if (heightDiff > 0) {
         for (let i = 0; i < heightDiff; i++) {
            this.matrix.push(this.newRow());
         }
      } else if (heightDiff < 0) {
         for (let i = 0; i > heightDiff; i--) {
            this.matrix.pop();
         }
      }
      this.syncDisplays();
   }

   editLeft(cols) {
      if (cols > 0) {
         for (let i = 0; i < cols; i++) {
            for (const row of this.matrix) {
               row.unshift(0);
            }
         }
      } else if (cols < 0) {
         for (let i = 0; i > cols; i--) {
            if (this.matrix[0].length > 1) {
               for (const row of this.matrix) {
                  row.shift();
               }
            }
         }
      }
      this.syncDisplays();
   }

   editRight(cols) {
      if (cols > 0) {
         for (let i = 0; i < cols; i++) {
            for (const row of this.matrix) {
               row.push(0);
            }
         }
      } else if (cols < 0) {
         for (let i = 0; i > cols; i--) {
            if (this.matrix[0].length > 1) {
               for (const row of this.matrix) {
                  row.pop();
               }
            }
         }
      }
      this.syncDisplays();
   }
}

// function replacer() {
//    .map(innerArray => [{innerArray.join(',')}]);
// }

//  return JSON.parse(value).map(innerArray => innerArray.join(','));
// return value.map(innerArray => `[${innerArray.join(',')}]`);
// return value.map(innerArray => JSON.parse(`[${innerArray.join(',')}]`));

function formatJSON(key, value) {
   if (key === 'matrix') {
      return value.map(matrixRow => `[${matrixRow.join(',')}]`);
   }
   return value;
}

function saveTypeface() {
   console.log('Building matrix file...');
   const outputFont = {
      name: font.name,
      styles: font.styles,
      glyphs: {}
   };
   for (const glyph in font.glyphs) {
      outputFont.glyphs[glyph] = {
         matrix: font.glyphs[glyph].matrix
      }
   }
   const a = document.createElement('a');
   a.href = URL.createObjectURL(new Blob([JSON.stringify(outputFont, null, '  ')], {type: 'text/plain'}));
   a.download = outputFont.name;
   a.click();
}

function exportTypeface() {
   console.log('Building OTF file...');
   const otfGridSize = 100;
   const dotRadius = font.styles.pixelSize / 2;
   let newGlyphs = [];
   const notdefGlyph = new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: font.styles.defaultWidth * otfGridSize,
      path: new opentype.Path()
   });
   newGlyphs.push(notdefGlyph);

   for (const glyph in font.glyphs) {
      console.log(`Building glyph ${glyph}`);
      let newCharPath = new opentype.Path();

      for (let y = 0; y < font.glyphs[glyph].matrix.length; y++) {
         for (let x = 0; x < font.glyphs[glyph].matrix[0].length; x++) {
            if (font.glyphs[glyph].matrix[font.glyphs[glyph].matrix.length - 1 - y][x] == 1) {
               newCharPath.moveTo((x + 0.5) * otfGridSize, (y + 0.5 - font.styles.baseline) * otfGridSize + dotRadius);
               newCharPath.curveTo(
                  (x + 0.5) * otfGridSize + kappa * dotRadius, (y + 0.5 - font.styles.baseline) * otfGridSize + dotRadius,
                  (x + 0.5) * otfGridSize + dotRadius, (y + 0.5 - font.styles.baseline) * otfGridSize + kappa * dotRadius,
                  (x + 0.5) * otfGridSize + dotRadius, (y + 0.5 - font.styles.baseline) * otfGridSize
               );
               newCharPath.curveTo(
                  (x + 0.5) * otfGridSize + dotRadius, (y + 0.5 - font.styles.baseline) * otfGridSize - kappa * dotRadius,
                  (x + 0.5) * otfGridSize + kappa * dotRadius, (y + 0.5 - font.styles.baseline) * otfGridSize - dotRadius,
                  (x + 0.5) * otfGridSize, (y + 0.5 - font.styles.baseline) * otfGridSize - dotRadius
               );
               newCharPath.curveTo(
                  (x + 0.5) * otfGridSize - kappa * dotRadius, (y + 0.5 - font.styles.baseline) * otfGridSize - dotRadius,
                  (x + 0.5) * otfGridSize - dotRadius, (y + 0.5 - font.styles.baseline) * otfGridSize - kappa * dotRadius,
                  (x + 0.5) * otfGridSize - dotRadius, (y + 0.5 - font.styles.baseline) * otfGridSize
               );
               newCharPath.curveTo(
                  (x + 0.5) * otfGridSize - dotRadius, (y + 0.5 - font.styles.baseline) * otfGridSize + kappa * dotRadius,
                  (x + 0.5) * otfGridSize - kappa * dotRadius, (y + 0.5 - font.styles.baseline) * otfGridSize + dotRadius,
                  (x + 0.5) * otfGridSize, (y + 0.5 - font.styles.baseline) * otfGridSize + dotRadius
               );
               newCharPath.close();
            }
         }
      }

      const newGlyph = new opentype.Glyph({
         name: String.fromCodePoint(glyph),
         unicode: glyph,
         advanceWidth: (font.glyphs[glyph].matrix[0].length + font.styles.tracking) * otfGridSize,
         path: newCharPath
      })
      newGlyphs.push(newGlyph);
   }
   console.log('Characters built successfully.');

   var otfFont = new opentype.Font({
      familyName: font.name,
      styleName: 'Dot Matrix',
      unitsPerEm: font.styles.defaultWidth * otfGridSize,
      ascender: (font.styles.height - font.styles.baseline) * otfGridSize,
      descender: -font.styles.baseline * otfGridSize,
      glyphs: newGlyphs
   });
   otfFont.download();
}

function importFont(event) {
   console.log('Importing...');
   let sourceFile = event.target.files[0];
   const fileReader = new FileReader();
   fileReader.readAsText(sourceFile);

   fileReader.onload = function(event) {
      const fontFile = event.target.result;
      const sourceFont = JSON.parse(fontFile);

      font.setName(sourceFont?.name);
      font.setPixelSize(sourceFont?.styles?.pixelSize);
      font.setTracking(sourceFont?.styles?.tracking);
      font.setBaseline(sourceFont?.styles?.baseline);
      if (sourceFont?.styles?.showBaseline == false) {
         font.hideBaseline();
      }

      if (sourceFont.pixelShape) {
         font.styles.pixelShape = sourceFont.styles.pixelShape;
      }

      font.setDefaultMatrix(sourceFont?.styles?.height ?? font.styles.height, sourceFont?.styles?.defaultWidth ?? font.styles.width);

      if (sourceFont?.styles?.widthLock) {
         font.styles.widthLock = sourceFont.styles.widthLock;
      }

      for (const glyph in sourceFont.glyphs) {
         new Glyph(glyph, sourceFont.glyphs[glyph].matrix);
      }
      font.sortGlyphs();
   }
}

// importButton.addEventListener('change', importFont);

// fontNameInput.addEventListener('input', function() {
//    font.name = fontNameInput.value;
// });

// importButton.addEventListener('change', function(e){
//    var reader = new FileReader();
//    reader.onload = function(e){
//       sourceFont = JSON.parse(e.target.result);
//    }
// })

// Used to determine dragging for the pixel editor
window.addEventListener('pointerdown', function(e) {
   mouseIsDown = true;
});

window.addEventListener('pointerup', function() {
   mouseIsDown = false;
});

document.addEventListener('keydown', function(e) {
   if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      copyToClipboard();
   }
   
   if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      pasteFromClipboard();
   }

   if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      currentGlyph.invert();
   }
   
   if ((e.ctrlKey || e.metaKey) && (e.key === 'Delete' || e.key === 'Backspace')) {
      currentGlyph.clear();
   }
});

checkPreferredTheme();
new Glyph('clipboard');

window.onload = () => {
   font.setCurrentGlyph(65);
}

window.addEventListener('beforeunload', (e) => {
   e.preventDefault();
});