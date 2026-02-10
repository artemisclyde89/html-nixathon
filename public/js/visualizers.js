/**
 * Checks if a value is a 2D matrix
 * @param {any} value
 * @returns {boolean}
 */
export function isMatrix(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    Array.isArray(value[0]) &&
    value.every((row) => Array.isArray(row))
  );
}

/**
 * Renders a matrix visual as HTML string
 * @param {string} label
 * @param {Array<Array<any>>} matrix
 * @returns {string} HTML string
 */
export function renderMatrix(label, matrix) {
  const uniqueValues = new Set();
  matrix.forEach((row) => {
    row.forEach((cell) => uniqueValues.add(String(cell)));
  });

  const colorMap = {};
  const valuesArray = Array.from(uniqueValues).sort();

  valuesArray.forEach((val, index) => {
    const hue = (index * 137.508) % 360;
    colorMap[val] = `hsla(${hue}, 70%, 50%, 0.6)`;
  });

  const rows = matrix
    .map((row) => {
      const cells = row
        .map((cell) => {
          const cellStr = String(cell);
          const bgColor = colorMap[cellStr];

          return `<div class="matrix-cell" style="background-color: ${bgColor};" title="${cell}">${cell}</div>`;
        })
        .join("");
      return `<div class="matrix-row">${cells}</div>`;
    })
    .join("");

  return `
        <div class="matrix-viz">
            <span class="matrix-label">${label}</span>
            <div class="matrix-legend">
                ${valuesArray
                  .map(
                    (val) =>
                      `<span class="legend-item"><span class="legend-dot" style="background-color: ${colorMap[val]}"></span>${val}</span>`,
                  )
                  .join("")}
            </div>
            ${rows}
        </div>
    `;
}

/**
 * Generates visualization HTML for all matrices found in the data
 * @param {object} data
 * @returns {string} HTML string
 */
export function generateVisualizations(data) {
  let visuals = "";

  if (isMatrix(data)) {
    visuals += renderMatrix("Root Matrix", data);
  } else if (data.body && isMatrix(data.body)) {
    visuals += renderMatrix("Body Matrix", data.body);
  } else if (typeof data === "object" && data !== null) {
    const target = data.body || data;
    if (typeof target === "object" && target !== null) {
      Object.keys(target).forEach((key) => {
        if (isMatrix(target[key])) {
          visuals += renderMatrix(key, target[key]);
        }
      });
    }
  }

  return visuals ? `<div class="visualizations">${visuals}</div>` : "";
}
