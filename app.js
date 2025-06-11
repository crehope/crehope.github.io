// app.js
let pdfDoc = null,
    currentPage = 1,
    totalPages = 0,
    pdfScale = 1.5,
    fabricCanvas = null,
    canvasHistory = [],
    historyIndex = -1,
    drawMode = false,
    isDragging = false,
    startX, startY,
    zoomFactor = 1;

const pdfCanvas = document.getElementById("pdf-bg-canvas");
const fabricCanvasEl = document.getElementById("pdf-canvas");
const canvasWrapper = document.getElementById("canvas-wrapper");

const ctx = pdfCanvas.getContext("2d");

fabricCanvas = new fabric.Canvas("pdf-canvas", {
    isDrawingMode: true,
    selection: false
});

fabricCanvas.freeDrawingBrush.color = document.getElementById("pen-color").value;
fabricCanvas.freeDrawingBrush.width = parseInt(document.getElementById("pen-width").value, 10);

function renderPage(num) {
    pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: pdfScale * zoomFactor });

        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;
        fabricCanvas.setWidth(viewport.width);
        fabricCanvas.setHeight(viewport.height);

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        page.render(renderContext).promise.then(() => {
            restoreCanvasState();
        });
    });

    document.getElementById("page-num").textContent = num;
}

function loadPDF(file) {
    const reader = new FileReader();
    reader.onload = function () {
        const typedarray = new Uint8Array(this.result);
        pdfjsLib.getDocument(typedarray).promise.then(function(pdfDoc_) {
            pdfDoc = pdfDoc_;
            totalPages = pdfDoc.numPages;
            document.getElementById("page-count").textContent = totalPages;
            currentPage = 1;
            renderPage(currentPage);
        });
    };
    reader.readAsArrayBuffer(file);
}

function prevPage() {
    if (currentPage <= 1) return;
    saveCanvasState();
    currentPage--;
    fabricCanvas.clear();
    renderPage(currentPage);
}

function nextPage() {
    if (currentPage >= totalPages) return;
    saveCanvasState();
    currentPage++;
    fabricCanvas.clear();
    renderPage(currentPage);
}

function toggleMode() {
    drawMode = !drawMode;
    fabricCanvas.isDrawingMode = drawMode;
    document.getElementById("mode-toggle").textContent = drawMode ? "서명" : "이동";
    document.getElementById("pdf-container").classList.toggle("draw-mode", drawMode);
}

document.getElementById("pen-color").addEventListener("change", function() {
    fabricCanvas.freeDrawingBrush.color = this.value;
});

document.getElementById("pen-width").addEventListener("change", function() {
    fabricCanvas.freeDrawingBrush.width = parseInt(this.value, 10);
});

function saveCanvasState() {
    if (historyIndex < canvasHistory.length - 1) {
        canvasHistory = canvasHistory.slice(0, historyIndex + 1);
    }
    canvasHistory.push(JSON.stringify(fabricCanvas.toJSON()));
    historyIndex++;
}

function restoreCanvasState() {
    if (canvasHistory[historyIndex]) {
        fabricCanvas.loadFromJSON(canvasHistory[historyIndex], fabricCanvas.renderAll.bind(fabricCanvas));
    }
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        fabricCanvas.clear();
        restoreCanvasState();
    }
}

function redo() {
    if (historyIndex < canvasHistory.length - 1) {
        historyIndex++;
        fabricCanvas.clear();
        restoreCanvasState();
    }
}

function zoomIn() {
    zoomFactor *= 1.1;
    renderPage(currentPage);
}

function zoomOut() {
    zoomFactor /= 1.1;
    renderPage(currentPage);
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    const promises = [];
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        promises.push(pdfDoc.getPage(pageNum).then(page => {
            const viewport = page.getViewport({ scale: pdfScale });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            return page.render({ canvasContext: context, viewport }).promise.then(() => {
                const img = canvas.toDataURL("image/jpeg");

                if (pageNum > 1) pdf.addPage();
                pdf.addImage(img, "JPEG", 0, 0, 210, 297);
            });
        }));
    }

    Promise.all(promises).then(() => {
        pdf.save("annotated.pdf");
    });
}

canvasWrapper.addEventListener("mousedown", (e) => {
    if (!drawMode) {
        isDragging = true;
        startX = e.pageX;
        startY = e.pageY;
    }
});

document.addEventListener("mousemove", (e) => {
    if (isDragging && !drawMode) {
        const dx = e.pageX - startX;
        const dy = e.pageY - startY;
        pdfCanvas.parentElement.scrollLeft -= dx;
        pdfCanvas.parentElement.scrollTop -= dy;
        startX = e.pageX;
        startY = e.pageY;
    }
});

document.addEventListener("mouseup", () => {
    isDragging = false;
});
