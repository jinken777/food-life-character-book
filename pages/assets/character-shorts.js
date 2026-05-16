(function () {
  const CSV_PATHS = [
    "../../shorts_rag.csv",
    "/shorts_rag.csv",
    "../shorts_rag.csv"
  ];

  const aliasMap = {
    "ルミマカロンCA": ["ルミマカロンCA", "ルミマカロン"],
    "もろこしジョー": ["もろこしジョー", "Morokoshi Joe"],
    "ぽこワッフル": ["ぽこワッフル", "Poko Waffle"],
    "アフロブロッコリー": ["アフロブロッコリー", "Afro Broccoli"],
    "ナス紳士": ["ナス紳士", "Nasu Gentleman"],
    "むすび山": ["むすび山", "Musubiyama"],
    "ブラックコーヒー社長": ["ブラックコーヒー社長", "Black Coffee CEO"],
    "レンコン親方": ["レンコン親方", "Renkon Oyakata"],
    "ノア": ["ノア", "Noa"]
  };

  const matchColumns = [
    "character",
    "main_character",
    "sub_character",
    "character_relationship",
    "recommended_character",
    "title",
    "hook",
    "zero_second_abnormality",
    "thumbnail_frame_description",
    "visual_prompt",
    "seedance_prompt"
  ];

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    return rows;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
    return rows.slice(1).map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = (row[index] || "").trim();
      });
      return item;
    });
  }

  function dateValue(value) {
    const parts = (value || "").trim().split(/[/-]/).map((part) => Number(part));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return 0;
    const [year, month, day] = parts;
    return new Date(year, month - 1, day).getTime();
  }

  function normalizeForMatch(value) {
    return (value || "").trim().toLowerCase();
  }

  function includesCharacter(row, aliases) {
    return matchColumns.some((column) => {
      const value = normalizeForMatch(row[column]);
      if (!value) return false;
      return aliases.some((alias) => value.includes(normalizeForMatch(alias)));
    });
  }

  function makeNote(row) {
    return (
      row.theme ||
      row.hook ||
      row.zero_second_abnormality ||
      row.gimmick_main ||
      row.story_structure ||
      ""
    ).trim();
  }

  function renderShort(row) {
    const title = row.title || "Untitled Short";
    const url = (row.url || "").trim();
    const note = makeNote(row);
    const postedDate = (row.posted_date || "").trim();

    const linkHtml = url
      ? `<a class="shorts-link" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">YouTube Shortsを見る</a>`
      : `<span class="shorts-missing">現時点では動画リンク未登録</span>`;

    const dateHtml = postedDate
      ? `<p class="shorts-date">${escapeHtml(postedDate)}</p>`
      : "";

    const noteHtml = note
      ? `<p class="shorts-note">${escapeHtml(note)}</p>`
      : "";

    return `
      <div class="shorts-item">
        <h3>${escapeHtml(title)}</h3>
        ${dateHtml}
        ${linkHtml}
        ${noteHtml}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function renderLoadError(message) {
    return `
      <div class="shorts-item">
        <span class="shorts-missing">Shortsを読み込めませんでした</span>
        <p class="shorts-note">${escapeHtml(message)}</p>
      </div>
    `;
  }

  async function fetchCsvText() {
    const errors = [];

    for (const path of CSV_PATHS) {
      try {
        const url = new URL(path, window.location.href);
        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) {
          errors.push(`${path}: HTTP ${response.status}`);
          continue;
        }

        const text = await response.text();
        if (!text.includes("main_character") || !text.includes("title")) {
          errors.push(`${path}: CSVヘッダーを確認できません`);
          continue;
        }

        return text;
      } catch (error) {
        errors.push(`${path}: ${error.message}`);
      }
    }

    throw new Error(errors.join(" / "));
  }

  async function hydrateShortsList(list) {
    const characterName = (list.dataset.character || "").trim();
    if (!characterName) return;

    const aliases = aliasMap[characterName] || [characterName];
    const text = await fetchCsvText();
    const rows = rowsToObjects(parseCsv(text));

    const relatedShorts = rows
      .filter((row) => includesCharacter(row, aliases))
      .sort((a, b) => dateValue(b.posted_date) - dateValue(a.posted_date));

    list.innerHTML = relatedShorts.length
      ? relatedShorts.map((row) => renderShort(row)).join("")
      : `
        <div class="shorts-item">
          <span class="shorts-missing">現時点では動画リンク未登録</span>
          <p class="shorts-note">shorts_rag.csv に、このキャラクターの登場Shortsがまだ登録されていません。</p>
        </div>
      `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".shorts-list[data-character]").forEach((list) => {
      hydrateShortsList(list).catch((error) => {
        console.warn("[Food Life] Shorts list fallback:", error);
        list.innerHTML = renderLoadError(error.message || "shorts_rag.csv の取得に失敗しました。");
      });
    });
  });
})();
