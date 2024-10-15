const svgNS = 'http://www.w3.org/2000/svg';

class DMGlyphEditor extends HTMLElement {
   static observedAttributes = ['codepoint'];
   constructor() {
      super();
      this.pixelSize = font.styles.pixelSize;
      this.pixelShape = font.styles.pixelShape;
      this.showBaseline = font.styles.showBaseline;
      this.baselineVal = font.styles.baseline;
      this.displayMatrix = [];
      this.display = document.createElementNS(svgNS, 'svg');

      this.baseline = document.createElementNS(svgNS, 'line');
      this.baseline.setAttribute('stroke-width', '0.3');
      this.baseline.setAttribute('stroke-dasharray', '5 1');

      this.appendChild(this.display);

      this.addEventListener('pointerdown', function(event) {
         if (event.target.dataset.x) {
            const x = event.target.dataset.x;
            const y = event.target.dataset.y;
            drawMode = 1 - this.fontMatrix[y][x];
            font.glyphs[this.codepoint].setPixel(x, y, drawMode);
         }
      });

      this.addEventListener('touchmove', function(event) {
         if (mouseIsDown) {
            const touches = event.touches;
            for (let i = 0; i < touches.length; i++) {
               const clickedElement = document.elementFromPoint(touches[i].clientX, touches[i].clientY);
               if (clickedElement.dataset.x) {
                  font.glyphs[this.codepoint].setPixel(clickedElement.dataset.x, clickedElement.dataset.y, drawMode);
               }
            }
         }
      });

      this.addEventListener('pointermove', function(event) {
         if (mouseIsDown && event.target.dataset.x) {
            font.glyphs[this.codepoint].setPixel(event.target.dataset.x, event.target.dataset.y, drawMode);
         }
      });

      document.addEventListener('sync-font-styles', this.syncStyles);
   }

   attributeChangedCallback() {
      document.removeEventListener(`sync-${this.codepoint}-matrix`, this.syncMatrix);
      document.removeEventListener(`set-${this.codepoint}-pixel`, e => {
         this.setPixel(e.detail.x, e.detail.y, e.detail.color);
      });
      this.codepoint = this.getAttribute('codepoint');
      if (isValidCodepoint(this.codepoint)) {
         this.fontMatrix = font.glyphs[this.codepoint].matrix;
      }
      document.addEventListener(`sync-${this.codepoint}-matrix`, this.syncMatrix);
      document.addEventListener(`set-${this.codepoint}-pixel`, e => {
         this.setPixel(e.detail.x, e.detail.y, e.detail.color);
      });

      this.clearDisplay();
      this.syncMatrix();
      this.syncBaseline();
   }

   syncBaseline = () => {
      this.baseline.setAttribute('x1', 0);
      this.baseline.setAttribute('x2', this.fontMatrix[0].length * gridSize);
      this.baseline.setAttribute('y1', (font.styles.height - font.styles.baseline) * gridSize);
      this.baseline.setAttribute('y2', (font.styles.height - font.styles.baseline) * gridSize);
      switch (font.styles.showBaseline) {
         case true:
            this.baseline.setAttribute('stroke', 'var(--fg-alt-2)');
            break;
         case false:
         default:
            this.baseline.setAttribute('stroke', 'none');
      }
      this.display.appendChild(this.baseline);
   }

   newPixel = (x, y, color) => {
      let pixel;
      switch (color) {
         case 1:
            // Square pixels
            pixel = document.createElementNS(svgNS, 'rect');
            pixel.setAttribute('x', x * gridSize + (1 - (this.pixelSize / 100)) * gridSize / 2);
            pixel.setAttribute('y', y * gridSize + (1 - (this.pixelSize / 100)) * gridSize / 2);
            pixel.setAttribute('width', gridSize * (this.pixelSize / 100));
            pixel.setAttribute('height', gridSize * (this.pixelSize / 100));
         case 0:
         default:
            // Round pixels
            pixel = document.createElementNS(svgNS, 'circle');
            pixel.setAttribute('cx', gridSize * (x + 0.5));
            pixel.setAttribute('cy', gridSize * (y + 0.5));
            pixel.setAttribute('r', this.pixelSize / 20);
            break;
      }

      pixel.setAttribute('data-x', x);
      pixel.setAttribute('data-y', y);
      pixel.style.transformOrigin = `${gridSize * (x + 0.5)}px ${gridSize * (y + 0.5)}px`;

      if (color == 1) {
         pixel.classList.add('active');
      }

      if (!this.displayMatrix[y]) {
         this.displayMatrix.push([]);
      }
      this.displayMatrix[y].push(pixel);
      this.display.appendChild(pixel);
   }

   setPixel = (x, y, color) => {
      if (!this.displayMatrix[y] || !this.displayMatrix[y][x]) {
         this.newPixel(x, y, color);
      } else {
         switch(color) {
            case 1:
               this.displayMatrix[y][x].classList.add('active');
               break;
            case 0:
            default:
               this.displayMatrix[y][x].classList.remove('active');
               break;
         }
      }
   }

   clearDisplay = () => {
      for (let y = 0; y < this.displayMatrix.length; y++) {
         for (let x = 0; x < this.displayMatrix[0].length; x++) {
            this.displayMatrix[y][x].remove();
         }
      }
      this.displayMatrix = [];
   }

   syncMatrix = () => {
      if (!this.fontMatrix) {
         return;
      }

      if (this.displayMatrix.length != this.fontMatrix.length || this.displayMatrix[0].length != this.fontMatrix[0].length) {
         this.display.setAttribute('viewBox', `0 0 ${this.fontMatrix[0].length * gridSize} ${font.styles.height * gridSize}`);
         if (this.displayMatrix.length > font.styles.height || this.displayMatrix[0]?.length > this.fontMatrix[0]?.length) {
            this.clearDisplay();
            this.syncMatrix();
         }
      }

      for (let y = 0; y < this.fontMatrix.length; y++) {
         for (let x = 0; x < this.fontMatrix[0].length; x++) {
            this.setPixel(x, y, this.fontMatrix[y][x]);
         }
      }

      this.syncBaseline();
   }

   syncStyles = () => {
      if (this.pixelSize != font.styles.pixelSize || this.pixelShape != font.styles.pixelShape || this.showBaseline != font.styles.showBaseline || this.baselineVal != font.styles.baseline) {
         this.pixelSize = font.styles.pixelSize;
         this.pixelShape = font.styles.pixelShape;
         this.showBaseline = font.styles.showBaseline;
         this.baselineVal = font.styles.baseline;
         this.clearDisplay();
         this.syncMatrix();
         this.syncBaseline();
      }
   }
}
customElements.define('dm-glyph-editor', DMGlyphEditor);

class DMFontSizeDisplay extends HTMLElement {
   constructor() {
      super();
      this.innerHTML = `
         <form id="font-size-display" class="column gap-s">
            <div class="column">
               <h3>Font size</h3>
               <div class="flex gap-s" style="flex-wrap: wrap;">
                  <div class="flex gap-s">
                     <label for="font-width-display">W</label>
                     <input id="font-width-display" name="font width" type="number" min="1" max="32">
                  </div>
                  <div class="flex gap-s">
                     <label for="font-height-display">H</label>
                     <input id="font-height-display" name="font height" type="number" min="1" max="32">
                  </div>
                  <button type="submit" class="hidden selected">
                     <span class="material-symbols-outlined">
                        check
                     </span>
                  </button
               </div>
            </div
         </form>
      `;
   }

   connectedCallback() {
      this.form = this.querySelector('#font-size-display');
      this.heightDisplay = this.querySelector('#font-height-display');
      this.widthDisplay = this.querySelector('#font-width-display');
      this.submitBtn = this.querySelector('#font-size-display button[type="submit"]')
      this.heightDisplay.addEventListener('input', () => {
         this.submitBtn.classList.remove('hidden');
      })
      this.widthDisplay.addEventListener('input', () => {
         this.submitBtn.classList.remove('hidden');
      })
      this.form.addEventListener('submit', this.setDefaultMatrix);
      document.addEventListener('sync-font-size', this.sync);
      this.sync();
   }

   sync = () => {
      this.heightDisplay.value = font.styles.height;
      this.widthDisplay.value = font.styles.defaultWidth;
      this.submitBtn.classList.add('hidden');
   }

   setDefaultMatrix = (e) => {
      e.preventDefault();
      font.setDefaultMatrix(this.heightDisplay.value, this.widthDisplay.value);
      this.submitBtn.classList.add('hidden');
   }
}
customElements.define('dm-font-size-display', DMFontSizeDisplay);

class DMWidthLock extends HTMLElement {
   constructor() {
      super();
      this.addEventListener('click', this.toggleWidthLock);
      document.addEventListener('sync-font-styles', this.sync);
      this.innerHTML = `
         <button onclick="this.sync">
            <span class="material-symbols-outlined">
            </span>
         </button>
      `;
   }

   connectedCallback() {
      this.btn = this.querySelector('button');
      this.lock = this.querySelector('.material-symbols-outlined');
      this.sync();
   }

   sync = () => {
      if (font.styles.widthLock) {
         this.btn.classList.add('selected');
         this.lock.innerText = 'lock';
      } else {
         this.btn.classList.remove('selected');
         this.lock.innerText = 'lock_open';
      }
   }

   toggleWidthLock = () => {
      font.styles.widthLock = !font.styles.widthLock;
      this.sync();
   }
}
customElements.define('dm-width-lock', DMWidthLock);

class DMPixelSizeInput extends HTMLElement {
   constructor() {
      super();
      this.innerHTML = `
         <h3>Dot size</h3>
         <div class="flex gap-xs">
            <input type="number" id="pixel-size" min="0" max="100">
            <p class="small">%</p>
         </div>
      `;
      document.addEventListener('sync-font-styles', this.sync);
   }

   connectedCallback() {
      this.pixelSizeInput = this.querySelector('#pixel-size');
      this.pixelSizeInput.addEventListener('input', () => {
         font.setPixelSize(this.pixelSizeInput.value);
      });
      this.pixelSizeInput.addEventListener('blur', () => {
         this.sync();
      })
      this.sync();
   }

   sync = () => {
      this.pixelSizeInput.value = font.styles.pixelSize;
   }
}
customElements.define('dm-pixel-size-input', DMPixelSizeInput);

class DMFontNameInput extends HTMLElement {
   constructor() {
      super();
      this.innerHTML = `
         <h3>Name</h3>
         <input type="text" id="font-name">
      `;
      this.addEventListener('input', () => {
         font.setName(this.nameInput.value);
      });
      document.addEventListener('sync-font-name', this.sync);
   }

   connectedCallback() {
      this.nameInput = this.querySelector('#font-name');
      this.sync();
   }

   sync = () => {
      this.nameInput.value = font.name;
   }
}
customElements.define('dm-font-name-input', DMFontNameInput);

class DMBaselineInput extends HTMLElement {
   constructor() {
      super();
      this.innerHTML = `
         <h3>Baseline</h3>
         <div class="flex gap-s">
            <button id="toggle-baseline"></button>
            <input type="number" id="font-baseline" min="0" max="32">
         </div>
      `;
      document.addEventListener('sync-font-styles', this.sync);
   }

   connectedCallback() {
      this.baselineInput = this.querySelector('#font-baseline');
      this.baselineToggle = this.querySelector('#toggle-baseline');
      this.baselineInput.addEventListener('input', () => {
         font.setBaseline(this.baselineInput.value);
         font.showBaseline();
      })
      this.sync();
   }

   sync = () => {
      this.baselineInput.value = font.styles.baseline;
      switch (font.styles.showBaseline) {
         case true:
            this.baselineToggle.onclick = () => font.hideBaseline();
            this.baselineToggle.innerHTML = `
               <span class="material-symbols-outlined">
                  visibility
               </span>
            `;
            break;
         case false:
         default:
            this.baselineToggle.onclick = () => font.showBaseline();
            this.baselineToggle.innerHTML = `
               <span class="material-symbols-outlined">
                  visibility_off
               </span>
            `;
      }
   }
}
customElements.define('dm-baseline-input', DMBaselineInput);

class DMTrackingInput extends HTMLElement {
   constructor() {
      super();
      this.innerHTML = `
         <div class="flex gap-s">
            <h3>Tracking</h3>
            <h3 id="tracking-display">A.B</h3>
         </div>
         <div class="flex gap-s">
            <input type="number" id="tracking-input" min="0" max="32">
         </div>
      `;
      document.addEventListener('sync-font-size', this.sync);
   }

   connectedCallback() {
      this.trackingDisplay = this.querySelector('#tracking-display');
      this.trackingInput = this.querySelector('#tracking-input');
      this.trackingInput.addEventListener('input', () => {
         font.setTracking(this.trackingInput.value);
      });
      this.sync();
   }

   sync = () => {
      let trackingDisplayText = 'A';
      for (let i = 0; i < font.styles.tracking; i++) {
         trackingDisplayText += '.'
      }
      trackingDisplayText += 'B'
      this.trackingDisplay.innerText = trackingDisplayText;

      this.trackingInput.value = font.styles.tracking;
   }
}
customElements.define('dm-tracking-input', DMTrackingInput);

class DMCurrentGlyphDisplay extends HTMLElement {
   constructor() {
      super();
      this.sync();
      document.addEventListener('sync-current-glyph', this.sync);
   }

   sync = () => {
      if (currentGlyph) {
         this.innerHTML = `Glyph<span> ${String.fromCodePoint(currentGlyph.codepoint)}</span>`;
      } else {
         this.innerHTML = 'Glyph';
      }
   }
}
customElements.define('dm-current-glyph-display', DMCurrentGlyphDisplay);

class DMGlyph extends HTMLElement {
   static observedAttributes = ['active'];
   constructor() {
      super();
      this.codepoint = this.getAttribute('codepoint');
      if (isValidCodepoint(this.codepoint)) {
         this.fontMatrix = font.glyphs[this.codepoint].matrix;
      } else if (this.codepoint == 'clipboard') {
         this.fontMatrix = font.clipboards[this.codepoint].matrix;
      }
      this.canvas = document.createElement('canvas');
      this.display = this.canvas.getContext('2d');
      this.pixelSize = font.styles.pixelSize;
      this.pixelShape = font.styles.pixelShape;
      this.showBaseline = font.styles.showBaseline;
      this.baselineVal = font.styles.baseline;
      
      if (this.hasAttribute('labeled')) {
         this.displayLabel = document.createElement('p');
         this.appendChild(this.displayLabel);
      }
      this.appendChild(this.canvas);
   }

   connectedCallback() {
      if (this.hasAttribute('labeled')) {
         this.displayLabel.innerText = String.fromCodePoint(this.codepoint);
         this.addEventListener('click', () => {
            font.setCurrentGlyph(this.codepoint);
         })
      }
      const canvasStyles = getComputedStyle(this.canvas);
      const fgMatch = canvasStyles.getPropertyValue('--fg-alt-0').match(/light-dark\(([^,]+),([^,]+)\)/);
      const bgMatch = canvasStyles.getPropertyValue('--bg-1').match(/light-dark\(([^,]+),([^,]+)\)/);
      const hlMatch = canvasStyles.getPropertyValue('--fg-alt-2').match(/light-dark\(([^,]+),([^,]+)\)/);

      this.fgLight = fgMatch[1];
      this.fgDark = fgMatch[2];
      this.bgLight = bgMatch[1];
      this.bgDark = bgMatch[2];
      this.hlLight = hlMatch[1];
      this.hlDark = hlMatch[2];

      document.addEventListener(`sync-${this.codepoint}-matrix`, this.syncMatrix);
      document.addEventListener('sync-font-styles', this.syncStyles);
      document.addEventListener('sync-font-colors', this.syncMatrix);
      document.addEventListener(`set-${this.codepoint}-pixel`, this.syncMatrix);
      this.syncMatrix();
   }

   disconnectedCallback() {
      this.removeEventListeners();
   }

   removeEventListeners() {
      document.removeEventListener(`sync-${this.codepoint}-matrix`, this.syncMatrix);
      document.removeEventListener('sync-font-styles', this.syncStyles);
      document.removeEventListener(`set-${this.codepoint}-pixel`, this.syncMatrix);
   }

   syncSize = () => {
      this.gridSize = this.canvas.clientHeight / font.styles.height * dpr;
      this.canvas.height = this.gridSize * font.styles.height;
      this.canvas.width = this.gridSize * this.fontMatrix[0].length;
   }

   syncMatrix = () => {
      if (this.height != this.fontMatrix.length || this.width != this.fontMatrix[0].length) {
         this.syncSize();
      }

      this.display.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (let y = 0; y < this.fontMatrix.length; y++){
         for (let x = 0; x < this.fontMatrix[0].length; x++){
            if (this.fontMatrix[y][x] == 1) {
               if (font.styles.theme == 'dark') {
                  this.display.fillStyle = this.fgDark;
               } else {
                  this.display.fillStyle = this.fgLight;
               }
            } else {
               if (font.styles.theme == 'dark') {
                  this.display.fillStyle = this.bgDark;
               } else {
                  this.display.fillStyle = this.bgLight;
               }
            }
            this.display.beginPath();

            if (this.pixelShape == 0) {
               // circle dots
               this.display.arc(x * this.gridSize + this.gridSize / 2, y * this.gridSize + this.gridSize / 2, this.gridSize * this.pixelSize / 200, 0, 2 * Math.PI);
               this.display.fill();
            } else {
               // square dots
               this.display.fillRect(j * this.gridSize + this.gridSize / 2 * (1 - this.pixelSize / 100), i * this.gridSize + this.gridSize / 2 * (1 - this.pixelSize / 100), this.rectSize, this.rectSize);
            }
            this.display.closePath();
         }
      }

      if (font.styles.showBaseline) {
         this.display.beginPath();
         this.display.setLineDash([15, 3]);
         if (font.styles.theme == 'dark') {
            this.display.strokeStyle = this.hlDark;
         } else {
            this.display.strokeStyle = this.hlLight;
         }
         this.display.lineWidth = 4;
         this.display.moveTo(0, (font.styles.height - font.styles.baseline) * this.gridSize);
         this.display.lineTo(this.fontMatrix[0].length * this.gridSize, (font.styles.height - font.styles.baseline) * this.gridSize);
         this.display.stroke();
         this.display.closePath();
      }
   }

   syncStyles = () => {
      if (this.pixelSize != font.styles.pixelSize || this.pixelShape != font.styles.pixelShape || this.showBaseline != font.styles.showBaseline || 
         this.baselineVal != font.styles.baseline) {
         this.pixelSize = font.styles.pixelSize;
         this.pixelShape = font.styles.pixelShape;
         this.showBaseline = font.styles.showBaseline;
         this.baselineVal = font.styles.baseline;
         this.syncMatrix();
      }
   }
}
customElements.define('dm-glyph', DMGlyph);

class DMCharset extends HTMLElement {
   constructor() {
      super();
      this.slug = this.getAttribute('charset');
      this.name = charsets[this.slug]?.name ?? `Charset ${this.slug} not found`;
      this.chars = charsets[this.slug]?.chars ?? [];
      this.innerHTML = `
         <article class="charset column">
            <div class="flex gap-m">
               <input type="checkbox" name="${this.name}" id="${this.slug}-checkbox">
               <label for="${this.slug}-checkbox" class="small">${this.name}</label>
            </div>
            <div class="glyph-container flex gap-m"></div>
         </article>
      `;
      font.charsets[this.slug] = this;
   }

   connectedCallback() {
      this.glyphContainer = this.querySelector('.glyph-container');
      this.charsetContainer = this.querySelector('.charset');
      this.checkbox = this.querySelector(`#${this.slug}-checkbox`);
      this.checkbox.addEventListener('click', () => {
         this.handleCharsetCheckbox()
      });
      if (charsets[this.slug].default) {
         this.buildChars();
      }
   }

   handleCharsetCheckbox = () => {
      if (this.checkbox.checked) {
         this.buildChars();
      } else {
         this.removeChars();
      }
   }

   buildChars = () => {
      let charsInnerHTML = '';
      for (const char of this.chars) {
         if (!font.glyphs[char]) {
            new Glyph(char);
         } else {
            delete font.glyphs[char]?.unsorted
         }
         charsInnerHTML += `<dm-glyph codepoint="${char}" class="column gap-xs" labeled></dm-glyph>`;
      }
      this.glyphContainer.innerHTML = charsInnerHTML;
      this.checkbox.checked = true;
      this.charsetContainer.classList.add('gap-m');
   }

   removeChars = () => {
      for (const char of this.chars) {
         delete font.glyphs[char];
      }

      while (this.glyphContainer.firstChild) {
         this.glyphContainer.removeChild(this.glyphContainer.firstChild);
      }

      this.checkbox.checked = false;
      this.charsetContainer.classList.remove('gap-m');
   }
}
customElements.define('dm-charset', DMCharset);

class DMTypeCase extends HTMLElement {
   constructor() {
      super();
      let typeCaseInnerHTML = '';
      for (const charset in charsets) {
         typeCaseInnerHTML += `
            <dm-charset charset="${charsets[charset].slug}"></dm-charset>
         `;
      };
      this.innerHTML = typeCaseInnerHTML;
   }
}
customElements.define('dm-type-case', DMTypeCase);

class SFToggle extends HTMLElement {
   constructor() {
      super();
      this.state = 0;
      this.toggleClass = this.getAttribute('toggle-class');
      this.innerHTML = `
         <button>
            <span class="material-symbols-outlined">
               tune
            </span>
         </button>
      `;
   }

   connectedCallback() {
      this.querySelector('button').onclick = () => this.sync();
      this.target = document.querySelectorAll(this.getAttribute('toggle-target'));
   }

   sync() {
      console.log('synced');
      if (document.startViewTransition) {
         document.startViewTransition(() => {
            this.toggle();
         });
      } else {
         this.toggle();
      }
   }

   toggle() {
      if(this.state) {
         this.target.forEach(element => {
            element.classList.remove(this.toggleClass);
         });
      } else {
         this.target.forEach(element => {
            element.classList.add(this.toggleClass);
         });
      }
      this.state = 1 - this.state;
   }
}
customElements.define('sf-toggle', SFToggle);

// class DMDisplay extends HTMLElement {
//    constructor() {
//       super();
//       this.pixelSize = font.styles.pixelSize;
//       this.pixelShape = font.styles.pixelShape;
//       this.showBaseline = font.styles.showBaseline;
//       this.baselineVal = font.styles.baseline;
//       this.displayMatrix = [];
//       this.display = document.createElementNS(svgNS, 'svg');

//       this.baseline = document.createElementNS(svgNS, 'line');
//       this.baseline.setAttribute('stroke-width', '0.3');
//       this.baseline.setAttribute('stroke-dasharray', '2 2');

//       this.innerHTML = `
//          <input type="text" id="dm-display-message">
//       `;
//       this.appendChild(this.display);
//    }

//    connectedCallback() {
//       this.input = this.querySelector('#dm-display-message');
//       this.input.addEventListener('input', this.syncMessage);
//    }

//    syncMessage = () => {
//       this.message = this.input.value;
//    }

//    // TODO: create baseline component

//    syncBaseline = () => {
//       this.baseline.setAttribute('x1', 0);
//       this.baseline.setAttribute('x2', this.fontMatrix[0].length * gridSize);
//       this.baseline.setAttribute('y1', (font.styles.height - font.styles.baseline) * gridSize);
//       this.baseline.setAttribute('y2', (font.styles.height - font.styles.baseline) * gridSize);
//       switch (font.styles.showBaseline) {
//          case true:
//             this.baseline.setAttribute('stroke', 'var(--hl-2)');
//             break;
//          case false:
//          default:
//             this.baseline.setAttribute('stroke', 'none');
//       }
//       this.display.appendChild(this.baseline);
//    }
// }
// customElements.define('dm-display', DMDisplay);