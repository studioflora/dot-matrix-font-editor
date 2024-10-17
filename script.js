const r = document.querySelector(':root');
const body = document.querySelector('body');
const editorGlyph = document.querySelector('#editor');

// Appearance
const lightModeBtn = document.querySelector('#light-mode');
const darkModeBtn = document.querySelector('#dark-mode');

// File options
const fontNameInput = document.querySelector('#font-name');

// Device pixel ratio
const dpr = window.devicePixelRatio || 1;

// Bezier curve constant
const kappa = 0.5522848;

// SVG grid size
const gridSize = 10;
const svgNS = 'http://www.w3.org/2000/svg';

let mouseIsDown = false;
let drawMode = 1;
let currentGlyph;
let charsets;

fetch('charsets.json')
   .then(response => response.json())
   .then(charsetData => {
      charsets = charsetData;
      console.log(charsets);
      document.dispatchEvent(new CustomEvent('charsets-loaded'));
   });

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

   reset() {
      this.forEachGlyph(glyph => glyph.clear());
      for (const charset in this.charsets) {
         this.charsets[charset].removeChars();
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
      unitsPerEm: font.styles.height * otfGridSize,
      ascender: (font.styles.height - font.styles.baseline) * otfGridSize,
      descender: -font.styles.baseline * otfGridSize,
      glyphs: newGlyphs
   });
   otfFont.download();
}

function importFont(event) {
   font.reset();
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
   // font.setCurrentGlyph(65);
}

window.addEventListener('beforeunload', (e) => {
   e.preventDefault();
});