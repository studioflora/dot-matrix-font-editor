const r = document.querySelector(':root');
const htmlElem = document.querySelector('html');
const body = document.querySelector('body');
const editorGlyph = document.querySelector('#editor');
const lightModeBtn = document.querySelector('#light-mode');
const darkModeBtn = document.querySelector('#dark-mode');
const fontNameInput = document.querySelector('#font-name');
const filePicker = document.querySelector('#file-picker');

// Device pixel ratio
const dpr = window.devicePixelRatio || 1;

// Bezier curve constant
const kappa = 0.5522848;

// SVG grid size
const gridSize = 10;
const svgNS = 'http://www.w3.org/2000/svg';

let mouseIsDown = false;
let workIsSaved = true;
let drawMode = 1;
let currentGlyph;
let charsets;

const defaultFont = {
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
   }
}

fetch('charsets.json')
   .then(response => response.json())
   .then(charsetData => {
      charsets = charsetData;
      document.dispatchEvent(new CustomEvent('charsets-loaded'));
   });

let font = {
   name: defaultFont.name,
   styles: {...defaultFont.styles},
   metadata: {
      "createdOn": Date.now()
   },
   glyphs: {},
   clipboards: {},
   charsets: {},
   version: 0,

   syncStyles: () => document.dispatchEvent(new CustomEvent('sync-font-styles')),
   syncColors: () => document.dispatchEvent(new CustomEvent('sync-font-colors')),
   syncFontSize: () => document.dispatchEvent(new CustomEvent('sync-font-size')),
   syncCurrentGlyph: () => document.dispatchEvent(new CustomEvent('sync-current-glyph')),
   syncName: () => document.dispatchEvent(new CustomEvent('sync-font-name')),
   syncDisplay: () => document.dispatchEvent(new CustomEvent('update-display-font')),

   forEachGlyph(callback) {
      for (const glyph in this.glyphs) {
         callback(this.glyphs[glyph]);
      }
      for (const glyph in this.clipboards) {
         callback(this.clipboards[glyph]);
      }
   },

   load(newFont = defaultFont) {
      if(!workIsSaved) {
         if(confirm('Are you sure you want to open a font? Any unsaved progress will be lost.')) {

         } else {
            return;
         }
      }
      this.forEachGlyph(glyph => glyph.clear());
      for (const charset in this.charsets) {
         this.charsets[charset].removeChars();
      }
      this.setName(newFont.name);
      this.metadata.createdOn = newFont?.metadata?.createdOn ?? Date.now();
      this.setPixelSize(newFont.styles?.pixelSize);
      this.setTracking(newFont.styles?.tracking);
      this.setBaseline(newFont.styles?.baseline);
      if (newFont.styles?.showBaseline == false) {
         this.hideBaseline();
      }

      if (newFont.styles?.pixelShape) {
         this.styles.pixelShape = newFont.styles.pixelShape;
      }

      this.setDefaultMatrix(newFont.styles?.height ?? this.styles.height, newFont.styles?.defaultWidth ?? this.styles.width, false);

      if (newFont.styles?.widthLock) {
         this.styles.widthLock = newFont.styles.widthLock;
      }

      for (const glyph in newFont?.glyphs) {
         new Glyph(glyph, newFont.glyphs[glyph].matrix);
      }
      this.sortGlyphs();
      workIsSaved = true;
   },

   setName(name) {
      // TODO add regex
      if (name == undefined) {
         return;
      }
      this.name = name;
      workIsSaved = false;
      this.syncName();
   },

   setPixelSize(pixelSize) {
      if (0 < pixelSize) {
         this.styles.pixelSize = pixelSize;
         workIsSaved = false;
         this.syncStyles();
      }
   },

   setTracking(tracking) {
      if (0 <= tracking && tracking <= 32) {
         this.styles.tracking = tracking;
         workIsSaved = false;
      }
      this.syncFontSize();
   },

   setBaseline(baseline) {
      if (0 <= baseline && baseline <= this.styles.height) {
         this.styles.baseline = baseline;
         workIsSaved = false;
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

   setDefaultMatrix(height, width, confirmDelete = true) {
      const heightDiff = height - this.styles.height;
      const widthDiff = width - this.styles.defaultWidth;

      if (heightDiff < 0 || widthDiff < 0) {
         if (confirmDelete) {
            if(confirm('Are you sure you want to change your glyph size? Some data may be lost.')) {
   
            } else {
               return;
            }
         }
      }
      this.styles.height = +height;
      this.styles.defaultWidth = +width;

      this.forEachGlyph(glyph => {
         glyph.syncTop();
         glyph.editRight(widthDiff);
      })
      workIsSaved = false;
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
      workIsSaved = false;
   },

   resetCurrentGlyph() {
      if(Object.values(this.glyphs)[0]?.hasOwnProperty('codepoint')) {
         this.setCurrentGlyph(Object.keys(this.glyphs)[0]);
         workIsSaved = false;
      } else {
      }
   },

   checkCurrentGlyph() {
      if (!this.glyphs.hasOwnProperty(currentGlyph.codepoint)) {
         this.resetCurrentGlyph();
      }
   },

   sortGlyphs() {
      let firstUnsortedGlyph;

      do {
         firstUnsortedGlyph = Object.values(this.glyphs).find(glyph => glyph.unsorted === true);
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

   copyToClipboard(clipboardID = 'clipboard') {
      this.clipboards[clipboardID].setMatrix(currentGlyph.matrix);
   },

   pasteFromClipboard(clipboardID = 'clipboard') {
      currentGlyph.setMatrix(this.clipboards[clipboardID].matrix);
   },

   editTop(rows) {
      if (rows < 0) {
         if(confirm('Delete top row from every glyph?')) {

         } else {
            return;
         }
      }
      this.styles.height += rows;
      if (this.styles.height < 1) {
         this.styles.height = 1;
      }
      if (this.styles.baseline > this.height) {
         this.setBaseline(this.height);
      }
      this.syncFontSize();
      this.forEachGlyph(glyph => glyph.syncTop());
      workIsSaved = false;
   },

   editBottom(rows) {
      if (rows < 0) {
         if(confirm('Delete bottom row from every glyph?')) {

         } else {
            return;
         }
      }
      this.styles.height += rows;
      this.setBaseline(+this.styles.baseline + +rows);
      if (this.styles.height < 1) {
         this.styles.height = 1;
      }
      this.syncFontSize();
      this.forEachGlyph(glyph => glyph.syncBottom());
      workIsSaved = false;
   },

   editLeft(cols) {
      if (this.styles.widthLock) {
         if (cols < 0) {
            if(confirm('Delete left column from every glyph?')) {
   
            } else {
               return;
            }
         }
         this.styles.defaultWidth += cols;
         if (this.styles.defaultWidth < 1) {
            this.styles.defaultWidth = 1;
         }
         this.syncFontSize();
         this.forEachGlyph(glyph => glyph.editLeft(cols));
      } else {
         currentGlyph.editLeft(cols);
      }
      workIsSaved = false;
   },

   editRight(cols) {
      if (this.styles.widthLock) {
         if (cols < 0) {
            if(confirm('Delete right column from every glyph?')) {
   
            } else {
               return;
            }
         }
         this.styles.defaultWidth += cols;
         if (this.styles.defaultWidth < 1) {
            this.styles.defaultWidth = 1;
         }
         this.syncFontSize();
         this.forEachGlyph(glyph => glyph.editRight(cols));
      } else {
         currentGlyph.editRight(cols);
      }
      workIsSaved = false;
   },

   isGlyphEmpty(codepoint) {
      for (let y = 0; y < this.styles.height; y++) {
         for (let x = 0; x < this.styles.defaultWidth; x++) {
            if (this.glyphs?.[codepoint]?.matrix[y][x] == 1) {
               return false;
            }
         }
      }
      return true;
   },
   
   isEmpty() {
      this.forEachGlyph(glyph => {
         if (!this.isGlyphEmpty(glyph.codepoint)) {
            return false;
         }
      });
      return true;
   },

   glyphCount() {
      let currentGlyphCount = 0;
      font.forEachGlyph(glyph => {
         if (!this.isGlyphEmpty(glyph.codepoint) || glyph.codepoint == '32') {
            currentGlyphCount++;
         }
      })
      return currentGlyphCount;
   },

   loadFromFile(event) {
      console.log('Importing...');
      let sourceFile = event.target.files[0];
      const fileReader = new FileReader();
      fileReader.readAsText(sourceFile);
   
      fileReader.onload = function(event) {
         const fontFile = event.target.result;
         const sourceFont = JSON.parse(fontFile);
         font.load(sourceFont);
      }
      font.setCurrentGlyph(Object.values(font.glyphs)[0].codepoint);
   },
   
   localSaveFont() {
      if(localSaves.hasOwnProperty(font.name)) {
         if(localSaves[font.name].metadata.createdOn != font.metadata.createdOn) {
            if(confirm('A font already exists with this name. Replace it?')) {

            } else {
               return;
            }
         }
      }
      const exportGlyphs = {};
      for (const glyph in font.glyphs) {
         exportGlyphs[glyph] = {
            matrix: font.glyphs[glyph].matrix
         }
      }
      font.metadata.lastEdit = Date.now();
      localSave(font.name, {
         name: font.name, 
         styles: font.styles, 
         glyphs: exportGlyphs, 
         metadata: font.metadata
      });
      workIsSaved = true;
   },

   localLoad() {}
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
      this.version = 0;
      this.matrix = [];
      this.syncDisplays = () => document.dispatchEvent(new CustomEvent(`sync-${this.codepoint}-matrix`));

      if (sourceMatrix) {
         this.setMatrix(sourceMatrix);
         this.unsorted = true;
      } else {
         this.resetMatrix();
      }
   }

   newRow = () => {
      return Array(this.matrix[0].length).fill(0);
   }

   setPixel = (x, y) => {
      this.matrix[y][x] = drawMode;
      const setPixelEvent = new CustomEvent(`set-${this.codepoint}-pixel`, { detail: {x: x, y: y, color: drawMode }});
      document.dispatchEvent(setPixelEvent);
      this.version++;
      workIsSaved = false;
   }

   setMatrix = (sourceMatrix) => {
      this.matrix.splice(0, this.matrix.length, ...sourceMatrix.map(row => [...row]));
      this.syncDisplays();
      this.version++;
      workIsSaved = false;
   }

   resetMatrix = () => {
      this.matrix = Array.from({ length: font.styles.height }, () => Array(font.styles.defaultWidth).fill(0));
      this.syncDisplays();
      this.version++;
      workIsSaved = false;
   }

   clear = () => {
      for (let y = 0; y < this.matrix.length; y++) {
         for (let x = 0; x < this.matrix[0].length; x++) {
            this.matrix[y][x] = 0;
         }
      }
      this.syncDisplays();
      this.version++;
      workIsSaved = false;
   }

   invert = () => {
      for (let y = 0; y < this.matrix.length; y++) {
         for (let x = 0; x < this.matrix[0].length; x++) {
            this.matrix[y][x] = 1 - this.matrix[y][x];
         }
      }
      this.syncDisplays();
      this.version++;
      workIsSaved = false;
   }

   flipVertical = () => {
      this.matrix.reverse();
      this.syncDisplays();
      this.version++;
      workIsSaved = false;
   }

   flipHorizontal = () => {
      this.matrix.map(row => row.reverse());
      this.syncDisplays();
      this.version++;
      workIsSaved = false;
   }

   syncTop() {
      const heightDiff = font.styles.height - this.matrix.length;
      if (heightDiff > 0) {
         for (let i = 0; i < heightDiff; i++) {
            this.matrix.unshift(this.newRow());
         }
         this.version++;
      } else if (heightDiff < 0) {
         for (let i = 0; i > heightDiff; i--) {
            this.matrix.shift();
         }
         this.version++;
      }
      this.syncDisplays();
   }

   syncBottom() {
      const heightDiff = font.styles.height - this.matrix.length;
      if (heightDiff > 0) {
         for (let i = 0; i < heightDiff; i++) {
            this.matrix.push(this.newRow());
         }
         this.version++;
      } else if (heightDiff < 0) {
         for (let i = 0; i > heightDiff; i--) {
            this.matrix.pop();
         }
         this.version++;
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
         this.version++;
      } else if (cols < 0) {
         for (let i = 0; i > cols; i--) {
            if (this.matrix[0].length > 1) {
               for (const row of this.matrix) {
                  row.shift();
               }
            }
         }
         this.version++;
      }
      this.syncDisplays();
      workIsSaved = false;
   }

   editRight(cols) {
      if (cols > 0) {
         for (let i = 0; i < cols; i++) {
            for (const row of this.matrix) {
               row.push(0);
            }
         }
         this.version++;
      } else if (cols < 0) {
         for (let i = 0; i > cols; i--) {
            if (this.matrix[0].length > 1) {
               for (const row of this.matrix) {
                  row.pop();
               }
            }
         }
         this.version++;
      }
      this.syncDisplays();
      workIsSaved = false;
   }
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

function formatJSON(key, value) {
   if (key === 'matrix') {
      return value.map(matrixRow => `[${matrixRow.join(',')}]`);
   }
   return value;
}

function saveTypeface(targetFont = font) {
   console.log('Building matrix file...');
   const outputFont = {
      name: targetFont.name,
      styles: targetFont.styles,
      glyphs: {}
   }
   for (const glyph in targetFont.glyphs) {
      outputFont.glyphs[glyph] = {
         matrix: targetFont.glyphs[glyph].matrix
      }
   }
   const a = document.createElement('a');
   a.href = URL.createObjectURL(new Blob([JSON.stringify(outputFont, null, '  ')], {type: 'text/plain'}));
   a.download = outputFont.name;
   a.click();
   workIsSaved = true;
}

function exportTypeface(targetFont = font) {
   console.log('Building OTF file...');
   const otfGridSize = 100;
   const dotRadius = targetFont.styles.pixelSize / 2;
   let newGlyphs = [];
   const notdefGlyph = new opentype.Glyph({
      name: '.notdef',
      unicode: 0,
      advanceWidth: (targetFont.styles.defaultWidth + +targetFont.styles.tracking) * otfGridSize,
      path: new opentype.Path()
   });
   newGlyphs.push(notdefGlyph);

   for (const glyph in targetFont.glyphs) {
      let newCharPath = new opentype.Path();

      for (let y = 0; y < targetFont.glyphs[glyph].matrix.length; y++) {
         for (let x = 0; x < targetFont.glyphs[glyph].matrix[0].length; x++) {
            if (targetFont.glyphs[glyph].matrix[targetFont.glyphs[glyph].matrix.length - 1 - y][x] == 1) {
               newCharPath.moveTo((x + 0.5) * otfGridSize, (y + 0.5 - targetFont.styles.baseline) * otfGridSize + dotRadius);
               newCharPath.curveTo(
                  (x + 0.5) * otfGridSize + kappa * dotRadius, (y + 0.5 - targetFont.styles.baseline) * otfGridSize + dotRadius,
                  (x + 0.5) * otfGridSize + dotRadius, (y + 0.5 - targetFont.styles.baseline) * otfGridSize + kappa * dotRadius,
                  (x + 0.5) * otfGridSize + dotRadius, (y + 0.5 - targetFont.styles.baseline) * otfGridSize
               );
               newCharPath.curveTo(
                  (x + 0.5) * otfGridSize + dotRadius, (y + 0.5 - targetFont.styles.baseline) * otfGridSize - kappa * dotRadius,
                  (x + 0.5) * otfGridSize + kappa * dotRadius, (y + 0.5 - targetFont.styles.baseline) * otfGridSize - dotRadius,
                  (x + 0.5) * otfGridSize, (y + 0.5 - targetFont.styles.baseline) * otfGridSize - dotRadius
               );
               newCharPath.curveTo(
                  (x + 0.5) * otfGridSize - kappa * dotRadius, (y + 0.5 - targetFont.styles.baseline) * otfGridSize - dotRadius,
                  (x + 0.5) * otfGridSize - dotRadius, (y + 0.5 - targetFont.styles.baseline) * otfGridSize - kappa * dotRadius,
                  (x + 0.5) * otfGridSize - dotRadius, (y + 0.5 - targetFont.styles.baseline) * otfGridSize
               );
               newCharPath.curveTo(
                  (x + 0.5) * otfGridSize - dotRadius, (y + 0.5 - targetFont.styles.baseline) * otfGridSize + kappa * dotRadius,
                  (x + 0.5) * otfGridSize - kappa * dotRadius, (y + 0.5 - targetFont.styles.baseline) * otfGridSize + dotRadius,
                  (x + 0.5) * otfGridSize, (y + 0.5 - targetFont.styles.baseline) * otfGridSize + dotRadius
               );
               newCharPath.close();
            }
         }
      }

      const newGlyph = new opentype.Glyph({
         name: String.fromCodePoint(glyph),
         unicode: glyph,
         advanceWidth: (targetFont.glyphs[glyph].matrix[0].length + +targetFont.styles.tracking) * otfGridSize,
         path: newCharPath
      })
      newGlyphs.push(newGlyph);
   }
   console.log('Characters built successfully.');

   var otfFont = new opentype.Font({
      familyName: targetFont.name,
      styleName: 'Dot Matrix',
      unitsPerEm: targetFont.styles.height * otfGridSize,
      ascender: (targetFont.styles.height - targetFont.styles.baseline) * otfGridSize,
      descender: -targetFont.styles.baseline * otfGridSize,
      glyphs: newGlyphs
   });
   otfFont.download();
   workIsSaved = true;
}

// Used to determine dragging for the pixel editor
window.addEventListener('pointerdown', function(e) {
   mouseIsDown = true;
});

window.addEventListener('pointerup', function() {
   mouseIsDown = false;
});

document.addEventListener('keydown', function(e) {
   if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      font.copyToClipboard();
   }
   
   if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      font.pasteFromClipboard();
   }

   if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      currentGlyph.invert();
   }

   if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveTypeface();
   }
   
   if ((e.ctrlKey || e.metaKey) && (e.key === 'Delete' || e.key === 'Backspace')) {
      currentGlyph.clear();
   }
});

checkPreferredTheme();
new Glyph('clipboard');

// const supportsDvh = () => { window.getComputedStyle(body).height == '100dvh' }
// const bodyHeightDisplay = document.querySelector('#body-height-display')
// let resizeTimeout;
// function resizeHeight() {
//    clearTimeout(resizeTimeout);
//    resizeTimeout = setTimeout(function() {
//       window.scrollTo(0, 0);
//       htmlElem.style.height = `${window.visualViewport.height}px`;
//       bodyHeightDisplay.innerHTML = `${window.visualViewport.height}px`;
//    }, 100);
// }

function showPreview() {

   font.syncDisplay();
   document.querySelector('#type-specimen').show();
   font.syncDisplay();
}

window.onload = () => {
   workIsSaved = true;
   // font.setCurrentGlyph(Object.keys(this.glyphs)[0]);
   // if (!supportsDvh) {
      // resizeHeight()

      // window.addEventListener('resize', resizeHeight);
      // window.addEventListener('orientationchange', resizeHeight);
      // window.addEventListener('focus', resizeHeight);
      // window.addEventListener('blur', resizeHeight);
   // }
   
}

window.addEventListener('beforeunload', (e) => {
   if(!workIsSaved) {
      e.preventDefault();
   }
});