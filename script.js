document.getElementById("uploadForm").addEventListener("submit", async function (e) { 
    e.preventDefault(); // ページリロードを防止

    const fileInput = document.getElementById("fileInput");
    if (fileInput.files.length === 0) {
        document.getElementById("output").innerHTML = `<p style="color: red;">画像を選択してください。</p>`;
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function () {
        const img = new Image();
        img.src = reader.result;
        img.onload = async function () {
            console.log("画像のロード完了、解析を開始します");

            // **正しいテンプレート画像の URL を指定**
            const templateImg = await loadTemplateImage("https://ryoup.github.io/3bMRQu247Wtr8pMABzdUVweAFXmnCYHYKuX5ZYX7BhaRMUSHSf7c7scUABxaFfRRRuZ3j85WH4bN4CVMQ2aMQ7sWigCRhEgSg7dw/template.png");

            // **テンプレート画像のロードが失敗した場合は処理を中止**
            if (!templateImg) {
                document.getElementById("output").innerHTML = `<p style="color: red;">テンプレート画像の取得に失敗しました。</p>`;
                return;
            }

            // **OpenCV で解析開始**
            processImage(img, templateImg);
        };
    };

    reader.readAsDataURL(file);
});

/**
 * `fetch()` を使って CORS 制限を回避しながらテンプレート画像を取得
 */
async function loadTemplateImage(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("テンプレート画像の取得に失敗しました");

        const blob = await response.blob();
        const img = new Image();
        img.src = URL.createObjectURL(blob);

        return new Promise((resolve) => {
            img.onload = () => resolve(img);
        });
    } catch (error) {
        console.error("❌ テンプレート画像のロードエラー:", error);
        return null; // エラー時は null を返す
    }
}

/**
 * OpenCV.js で画像処理を実行
 */
function processImage(img, templateImg) {
    document.getElementById("output").innerHTML = "<h2>検出中…</h2>";

    setTimeout(() => {
        // **画像を `<canvas>` に描画**
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);

        // **OpenCV.js の画像データに変換**
        const src = cv.imread(canvas);

        // **テンプレート画像の処理**
        const templateCanvas = document.createElement("canvas");
        const templateCtx = templateCanvas.getContext("2d");
        templateCanvas.width = templateImg.width;
        templateCanvas.height = templateImg.height;
        templateCtx.drawImage(templateImg, 0, 0, templateImg.width, templateImg.height);

        const template = cv.imread(templateCanvas);

        const dst = new cv.Mat();
        const mask = new cv.Mat();

        // **テンプレートマッチング**
        cv.matchTemplate(src, template, dst, cv.TM_CCOEFF_NORMED, mask);

        // **類似度がしきい値を超えたすべての候補を取得**
        const threshold = 0.5; // しきい値（高いほど厳しくなる）
        const points = [];
        const minDistance = 20; // 30px 以内の重複を排除

        for (let y = 0; y < dst.rows; y++) {
            for (let x = 0; x < dst.cols; x++) {
                const similarity = dst.floatAt(y, x);
                if (similarity >= threshold) {
                    let isDuplicate = false;

                    // **既に検出された P の座標と比較**
                    for (const point of points) {
                        const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
                        if (distance < minDistance) {
                            isDuplicate = true;
                            break;
                        }
                    }

                    // **新しい P の座標なら追加**
                    if (!isDuplicate) {
                        points.push({ x, y, similarity });
                    }
                }
            }
        }

        console.log(`検出された P の候補数（重複排除後）: ${points.length}`);

        if (points.length > 0) {
            points.sort((a, b) => b.similarity - a.similarity); // 類似度が高い順にソート
            extractPRegions(img, points);
        } else {
            document.getElementById("output").innerHTML = "<p style='color: red;'>P が見つかりませんでした。</p>";
        }

        src.delete();
        template.delete();
        dst.delete();
        mask.delete();
    }, 500);
}


/**
 * 複数の P の候補を切り取って表示
 */
function extractPRegions(img, points) {
    const outputDiv = document.getElementById("output");
    outputDiv.innerHTML = "<h2>検出された P の候補</h2>";

    let selectedCoord = null; // 1つだけ保存する

    points.forEach((point, index) => {
        const { x, y } = point;

        // **切り取り範囲**
        const cropWidth = 200; // 横幅を80px
        const cropHeight = 200; // 縦幅を100px
        const offsetY = 15; // P の位置より 10px 上から開始

        const croppedCanvas = document.createElement("canvas");
        const ctx = croppedCanvas.getContext("2d");

        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;
        ctx.drawImage(img, x - cropWidth / 2, y - offsetY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        // **画像を表示し、クリックで座標を取得**
        const imgElement = document.createElement("img");
        imgElement.src = croppedCanvas.toDataURL();
        imgElement.className = "result-img";
        imgElement.onclick = function () {
            selectedCoord = { x, y }; // クリックされた座標を保存
            updateSelectedCoords(selectedCoord);
        };

        outputDiv.appendChild(imgElement);
    });
}

/**
 * クリックした座標を上書き表示
 */
function updateSelectedCoords(coord) {
    const selectedDiv = document.getElementById("selectedCoords");
    selectedDiv.innerHTML = `<h3>選択した P の座標:</h3>
                             <p>X: ${coord.x}, Y: ${coord.y}</p>`;
}
