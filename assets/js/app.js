import {
  convertImagesToPdf,
  convertImageFormats,
  convertPdfToImages,
  createZipBlob,
} from "./modules/converter.js";

const SELECTORS = {
  dropZone: "[data-drop-zone]",
  dropCaption: "[data-drop-caption]",
  fileInput: "[data-file-input]",
  fileList: "[data-file-list]",
  resultList: "[data-result-list]",
  fileCount: "[data-file-count]",
  status: "[data-status]",
  message: "[data-message]",
  modeButtons: "[data-mode-button]",
  outputFormat: "[data-output-format]",
  qualityInput: "[data-quality-input]",
  pdfScale: "[data-pdf-scale]",
  formatOption: "[data-format-option]",
  qualityOption: "[data-quality-option]",
  scaleOption: "[data-scale-option]",
  convertButton: "[data-convert-button]",
  resetButton: "[data-reset-button]",
  downloadAllButton: "[data-download-all-button]",
};

const MODES = {
  imagesToPdf: "images-to-pdf",
  pdfToImages: "pdf-to-images",
  imageFormat: "image-format",
};

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

class ConverterApp {
  constructor(root = document) {
    this.root = root;
    this.state = {
      mode: MODES.imagesToPdf,
      files: [],
      previewUrls: new Map(),
      outputs: [],
      downloadAllUrl: "",
      isConverting: false,
    };

    this.bindElements();
    this.bindEvents();
    this.updateModeUi();
    this.render();
  }

  bindElements() {
    this.dropZone = this.root.querySelector(SELECTORS.dropZone);
    this.dropCaption = this.root.querySelector(SELECTORS.dropCaption);
    this.fileInput = this.root.querySelector(SELECTORS.fileInput);
    this.fileList = this.root.querySelector(SELECTORS.fileList);
    this.resultList = this.root.querySelector(SELECTORS.resultList);
    this.fileCount = this.root.querySelector(SELECTORS.fileCount);
    this.status = this.root.querySelector(SELECTORS.status);
    this.message = this.root.querySelector(SELECTORS.message);
    this.modeButtons = [...this.root.querySelectorAll(SELECTORS.modeButtons)];
    this.outputFormat = this.root.querySelector(SELECTORS.outputFormat);
    this.qualityInput = this.root.querySelector(SELECTORS.qualityInput);
    this.pdfScale = this.root.querySelector(SELECTORS.pdfScale);
    this.formatOption = this.root.querySelector(SELECTORS.formatOption);
    this.qualityOption = this.root.querySelector(SELECTORS.qualityOption);
    this.scaleOption = this.root.querySelector(SELECTORS.scaleOption);
    this.convertButton = this.root.querySelector(SELECTORS.convertButton);
    this.resetButton = this.root.querySelector(SELECTORS.resetButton);
    this.downloadAllButton = this.root.querySelector(SELECTORS.downloadAllButton);
  }

  bindEvents() {
    this.fileInput.addEventListener("change", (event) => {
      this.setFiles([...event.target.files]);
    });

    this.modeButtons.forEach((button) => {
      button.addEventListener("click", () => this.setMode(button.dataset.mode));
    });

    this.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      this.dropZone.classList.add("is-dragging");
      this.dropCaption.textContent = "여기에 놓기";
    });

    this.dropZone.addEventListener("dragleave", () => this.resetDropCaption());

    this.dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      this.resetDropCaption();
      this.setFiles([...event.dataTransfer.files]);
    });

    this.convertButton.addEventListener("click", () => this.convert());
    this.resetButton.addEventListener("click", () => this.reset());
    this.downloadAllButton.addEventListener("click", () => this.downloadAll());
    this.outputFormat.addEventListener("change", () => this.updateModeUi());
  }

  setMode(mode) {
    if (!Object.values(MODES).includes(mode)) return;

    this.clearOutputs();
    this.state.mode = mode;
    this.updateModeUi();
    this.render();
  }

  setFiles(files) {
    const usableFiles = files.filter((file) => ACCEPTED_TYPES.has(file.type));
    this.clearOutputs();
    this.clearPreviews();
    this.state.files = usableFiles;

    usableFiles.forEach((file) => {
      if (IMAGE_TYPES.has(file.type)) {
        this.state.previewUrls.set(file, URL.createObjectURL(file));
      }
    });

    if (files.length !== usableFiles.length) {
      this.setMessage("지원하지 않는 파일은 제외했습니다.");
    } else {
      this.setMessage("");
    }

    this.render();
  }

  async convert() {
    if (this.state.isConverting || !this.state.files.length) return;

    const validation = this.validateSelection();
    if (!validation.ok) {
      this.setMessage(validation.message);
      return;
    }

    this.clearOutputs();
    this.state.isConverting = true;
    this.setStatus("변환 중");
    this.setMessage("");
    this.renderButtons();
    this.resultList.classList.add("is-processing");

    try {
      const options = this.getOptions();
      const outputs = await this.runConversion(options);
      this.state.outputs = outputs.map((output) => ({
        ...output,
        url: URL.createObjectURL(output.blob),
      }));
      this.setStatus("완료");
    } catch (error) {
      console.error(error);
      this.setStatus("오류");
      this.setMessage(error.message || "변환에 실패했습니다.");
    } finally {
      this.state.isConverting = false;
      this.resultList.classList.remove("is-processing");
      this.render();
    }
  }

  async runConversion(options) {
    if (this.state.mode === MODES.imagesToPdf) {
      return convertImagesToPdf(this.state.files);
    }

    if (this.state.mode === MODES.pdfToImages) {
      return convertPdfToImages(this.state.files, options);
    }

    return convertImageFormats(this.state.files, options);
  }

  validateSelection() {
    const files = this.state.files;
    if (!files.length) return { ok: false, message: "변환할 파일을 먼저 선택해 주세요." };

    if (this.state.mode === MODES.imagesToPdf && files.some((file) => !IMAGE_TYPES.has(file.type))) {
      return { ok: false, message: "이미지 → PDF는 JPG, PNG, WEBP 파일만 사용할 수 있습니다." };
    }

    if (this.state.mode === MODES.pdfToImages && files.some((file) => file.type !== "application/pdf")) {
      return { ok: false, message: "PDF → 이미지는 PDF 파일만 사용할 수 있습니다." };
    }

    if (this.state.mode === MODES.imageFormat && files.some((file) => !IMAGE_TYPES.has(file.type))) {
      return { ok: false, message: "이미지 포맷 변환은 JPG, PNG, WEBP 파일만 사용할 수 있습니다." };
    }

    return { ok: true, message: "" };
  }

  getOptions() {
    return {
      format: this.outputFormat.value,
      quality: Number(this.qualityInput.value) / 100,
      scale: Number(this.pdfScale.value),
    };
  }

  async downloadAll() {
    if (!this.state.outputs.length) return;

    if (this.state.outputs.length === 1) {
      downloadUrl(this.state.outputs[0].url, this.state.outputs[0].name);
      return;
    }

    if (this.state.downloadAllUrl) URL.revokeObjectURL(this.state.downloadAllUrl);

    const zipBlob = await createZipBlob(this.state.outputs);
    this.state.downloadAllUrl = URL.createObjectURL(zipBlob);
    downloadUrl(this.state.downloadAllUrl, "converted-files.zip");
  }

  reset() {
    this.fileInput.value = "";
    this.clearOutputs();
    this.clearPreviews();
    this.state.files = [];
    this.setStatus("준비됨");
    this.setMessage("");
    this.render();
  }

  render() {
    this.renderFiles();
    this.renderResults();
    this.renderButtons();
    this.fileCount.textContent = `${this.state.files.length}개`;
  }

  renderFiles() {
    clearDynamicItems(this.fileList);
    this.fileList.classList.toggle("is-empty", this.state.files.length === 0);

    this.state.files.forEach((file) => {
      const item = document.createElement("div");
      item.className = "file-item";
      item.innerHTML = `
        <div class="file-thumb">${getExtension(file.name)}</div>
        <div>
          <p class="file-name"></p>
          <p class="file-meta">${file.type || "unknown"} · ${formatBytes(file.size)}</p>
        </div>
      `;

      const name = item.querySelector(".file-name");
      const thumb = item.querySelector(".file-thumb");
      name.textContent = file.name;

      const previewUrl = this.state.previewUrls.get(file);
      if (previewUrl) {
        const image = document.createElement("img");
        image.src = previewUrl;
        image.alt = "";
        thumb.textContent = "";
        thumb.append(image);
      }

      this.fileList.append(item);
    });
  }

  renderResults() {
    clearDynamicItems(this.resultList);
    this.resultList.classList.toggle("is-empty", this.state.outputs.length === 0);

    this.state.outputs.forEach((output) => {
      const item = document.createElement("div");
      item.className = "result-item";
      item.innerHTML = `
        <div class="result-thumb">${getExtension(output.name)}</div>
        <div>
          <p class="result-name"></p>
          <p class="result-meta">${formatBytes(output.blob.size)}</p>
        </div>
        <a class="download-link" href="${output.url}" download>다운로드</a>
      `;

      item.querySelector(".result-name").textContent = output.name;
      item.querySelector(".download-link").download = output.name;

      if (output.blob.type.startsWith("image/")) {
        const image = document.createElement("img");
        image.src = output.url;
        image.alt = "";
        const thumb = item.querySelector(".result-thumb");
        thumb.textContent = "";
        thumb.append(image);
      }

      this.resultList.append(item);
    });
  }

  renderButtons() {
    const hasFiles = this.state.files.length > 0;
    const hasOutputs = this.state.outputs.length > 0;

    this.convertButton.disabled = !hasFiles || this.state.isConverting;
    this.resetButton.disabled = !hasFiles && !hasOutputs;
    this.downloadAllButton.disabled = !hasOutputs || this.state.isConverting;
  }

  updateModeUi() {
    this.modeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === this.state.mode);
    });

    const isImagesToPdf = this.state.mode === MODES.imagesToPdf;
    const isPdfToImages = this.state.mode === MODES.pdfToImages;

    this.formatOption.hidden = isImagesToPdf;
    this.qualityOption.hidden = isImagesToPdf || this.outputFormat.value === "png";
    this.scaleOption.hidden = !isPdfToImages;
    this.fileInput.accept = isPdfToImages ? "application/pdf" : "image/jpeg,image/png,image/webp";
    this.dropCaption.textContent = isPdfToImages ? "PDF" : "JPG, PNG, WEBP";
  }

  clearOutputs() {
    this.state.outputs.forEach((output) => URL.revokeObjectURL(output.url));
    if (this.state.downloadAllUrl) URL.revokeObjectURL(this.state.downloadAllUrl);
    this.state.outputs = [];
    this.state.downloadAllUrl = "";
  }

  clearPreviews() {
    this.state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    this.state.previewUrls.clear();
  }

  resetDropCaption() {
    this.dropZone.classList.remove("is-dragging");
    this.dropCaption.textContent = this.state.mode === MODES.pdfToImages ? "PDF" : "JPG, PNG, WEBP";
  }

  setStatus(message) {
    this.status.textContent = message;
  }

  setMessage(message) {
    this.message.textContent = message;
    this.message.hidden = !message;
  }
}

function clearDynamicItems(container) {
  [...container.children].forEach((child) => {
    if (!child.classList.contains("empty-state") && !child.classList.contains("processing-layer")) {
      child.remove();
    }
  });
}

function downloadUrl(url, name) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
}

function getExtension(fileName) {
  return fileName.split(".").pop()?.slice(0, 4) || "file";
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

new ConverterApp();
