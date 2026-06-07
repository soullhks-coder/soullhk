import { PDFDocument } from "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js";
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

const IMAGE_MIME = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function convertImagesToPdf(files) {
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    const embeddedImage = await embedImage(pdfDoc, file);
    const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: embeddedImage.width,
      height: embeddedImage.height,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const name = files.length === 1 ? `${baseName(files[0].name)}.pdf` : "images-to-pdf.pdf";

  return [
    {
      name,
      blob: new Blob([pdfBytes], { type: "application/pdf" }),
    },
  ];
}

export async function convertImageFormats(files, { format, quality }) {
  const mimeType = IMAGE_MIME[format];
  const outputs = [];

  for (const file of files) {
    const blob = await imageFileToBlob(file, mimeType, quality);
    outputs.push({
      name: `${baseName(file.name)}.${format}`,
      blob,
    });
  }

  return outputs;
}

export async function convertPdfToImages(files, { format, quality, scale }) {
  const mimeType = IMAGE_MIME[format];
  const outputs = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const blob = await canvasToBlob(canvas, mimeType, quality);
      outputs.push({
        name: `${baseName(file.name)}-${String(pageNumber).padStart(3, "0")}.${format}`,
        blob,
      });
    }

    await pdf.destroy();
  }

  return outputs;
}

export async function createZipBlob(outputs) {
  const zip = new JSZip();

  outputs.forEach((output) => {
    zip.file(output.name, output.blob);
  });

  return zip.generateAsync({ type: "blob" });
}

async function embedImage(pdfDoc, file) {
  const bytes = new Uint8Array(await normalizedImageBlob(file).then((blob) => blob.arrayBuffer()));

  if (file.type === "image/jpeg") {
    return pdfDoc.embedJpg(bytes);
  }

  return pdfDoc.embedPng(bytes);
}

async function normalizedImageBlob(file) {
  if (file.type === "image/jpeg" || file.type === "image/png") return file;
  return imageFileToBlob(file, "image/png", 1);
}

async function imageFileToBlob(file, mimeType, quality) {
  const image = await loadImage(URL.createObjectURL(file));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  if (mimeType === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0);
  URL.revokeObjectURL(image.src);

  return canvasToBlob(canvas, mimeType, quality);
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("이 브라우저에서 해당 포맷으로 저장할 수 없습니다."));
      },
      mimeType,
      quality,
    );
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
    image.src = src;
  });
}

function baseName(fileName) {
  return fileName.replace(/\.[^.]+$/, "") || "converted";
}
