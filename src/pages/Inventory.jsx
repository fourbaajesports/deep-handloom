
import { useState } from "react";
import * as XLSX from "xlsx";
import productsData from "../data/products";

const STORAGE_KEY = "deepHandloomProducts";

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function parseSizes(value) {
  return String(value ?? "")
    .split(/[,;|]/)
    .map((size) => size.trim())
    .filter(Boolean);
}

function parseBoolean(value) {
  const text = String(value ?? "").trim().toLowerCase();

  if (
    ["false", "no", "0", "sold", "out of stock", "outofstock"].includes(text)
  ) {
    return false;
  }

  if (
    ["true", "yes", "1", "available", "in stock", "instock"].includes(text)
  ) {
    return true;
  }

  return true;
}

function readProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.error("Could not read inventory:", error);
  }

  return productsData;
}

function getCode(product) {
  return String(product.code || product.id || "").trim();
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new Event("deepHandloomProductsUpdated"));
}

function imageSearchUrl(product) {
  const query = [
    product.brand,
    getCode(product),
    product.color || product.colour,
    product.category,
    "official product",
  ]
    .filter(Boolean)
    .join(" ");

  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

function isValidImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function downloadWorkbook(rows, filename, sheetName) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

export default function Inventory() {
  const [products, setProducts] = useState(readProducts);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [imageLines, setImageLines] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function updateProducts(next) {
    setProducts(next);
    saveProducts(next);
  }

  function downloadTemplate() {
    const headers = [
      "code",
      "name",
      "brand",
      "category",
      "sizes",
      "price",
      "discountPrice",
      "discountPercent",
      "inStock",
      "image",
      "color",
    ];

    const example = [
      "MFS-17200-X",
      "Example Shirt",
      "Mufti",
      "Shirts",
      "M,L,XL,XXL",
      2499,
      1999,
      20,
      true,
      "",
      "Pink",
    ];

    downloadWorkbook(
      [headers, example],
      "deep-handloom-template.xlsx",
      "Products"
    );
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      if (rows.length < 2) {
        throw new Error("Excel mein headings aur product rows honi chahiye.");
      }

      const headers = rows[0].map(normalizeHeader);
      const col = (...names) => headers.findIndex((h) => names.includes(h));

      const columns = {
        code: col("code", "productcode", "stylecode", "designcode", "sku"),
        name: col("name", "productname", "itemname", "product", "item"),
        brand: col("brand", "brandname"),
        category: col("category", "type", "producttype"),
        sizes: col("sizes", "size"),
        price: col("price", "mrp", "sellingprice"),
        discountPrice: col("discountprice", "saleprice", "offerprice"),
        discountPercent: col("discountpercent", "discount"),
        inStock: col("instock", "stock", "available", "status"),
        image: col("image", "imageurl", "photourl"),
        color: col("color", "colour"),
      };

      const missing = ["code", "name", "brand", "category", "price"].filter(
        (key) => columns[key] === -1
      );

      if (missing.length) {
        throw new Error(
          `Excel mein required columns missing hain: ${missing.join(", ")}`
        );
      }

      const existingByCode = new Map(
        products.map((product) => [
          getCode(product).toLowerCase(),
          product,
        ])
      );

      const imported = [];
      const codes = new Set();

      rows.slice(1).forEach((row, index) => {
        const rowNumber = index + 2;

        const value = (key) =>
          columns[key] === -1
            ? ""
            : String(row[columns[key]] ?? "").trim();

        const code = value("code");
        const name = value("name");
        const brand = value("brand");
        const category = value("category");

        if (!code && !name && !brand) return;

        if (!code || !name || !brand || !category) {
          throw new Error(
            `Row ${rowNumber}: code, name, brand aur category required hain.`
          );
        }

        const normalizedCode = code.toLowerCase();

        if (codes.has(normalizedCode)) {
          throw new Error(
            `Row ${rowNumber}: duplicate product code "${code}". Same design ke sizes ek row mein comma-separated rakho.`
          );
        }

        codes.add(normalizedCode);

        const cleanNumber = (text) =>
          Number(String(text).replace(/[₹,\s]/g, ""));

        const price = cleanNumber(value("price"));
        const discountText = value("discountPrice");
        const discountPrice = discountText
          ? cleanNumber(discountText)
          : price;

        if (
          !Number.isFinite(price) ||
          price < 0 ||
          !Number.isFinite(discountPrice) ||
          discountPrice < 0 ||
          discountPrice > price
        ) {
          throw new Error(
            `Row ${rowNumber}: price ya discount price invalid hai.`
          );
        }

        const oldProduct = existingByCode.get(normalizedCode);
        const imageFromExcel = value("image");

        if (imageFromExcel && !isValidImageUrl(imageFromExcel)) {
          throw new Error(
            `Row ${rowNumber}: image column mein valid URL nahi hai.`
          );
        }

        const percentText = value("discountPercent");
        const discountPercent = percentText
          ? Number(percentText.replace("%", ""))
          : price > 0
            ? Math.round(((price - discountPrice) / price) * 100)
            : 0;

        imported.push({
          ...(oldProduct || {}),
          id: oldProduct?.id || code,
          code,
          name,
          brand,
          category,
          sizes: parseSizes(value("sizes")),
          price,
          discountPrice,
          discountPercent,
          inStock: value("inStock")
            ? parseBoolean(value("inStock"))
            : oldProduct?.inStock ?? true,
          image: imageFromExcel || oldProduct?.image || `/products/${code}.jpg`,
          color: value("color") || oldProduct?.color || "",
        });
      });

      if (!imported.length) {
        throw new Error("Koi valid product nahi mila.");
      }

      const oldCodes = new Set(
        products.map((product) => getCode(product).toLowerCase())
      );
      const newCount = imported.filter(
        (product) => !oldCodes.has(getCode(product).toLowerCase())
      ).length;
      const updatedCount = imported.length - newCount;

      updateProducts(imported);
      setSelected([]);
      setMessage(
        `Import complete: ${newCount} naye products, ${updatedCount} existing products update hue. Matching codes ki saved images preserve ki gayi hain.`
      );
    } catch (err) {
      setError(err.message || "Excel import fail hua.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  const filtered = products.filter((product) => {
    const query = search.toLowerCase();

    return [
      product.code,
      product.name,
      product.brand,
      product.category,
      product.color,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });

  function toggleProduct(code) {
    setSelected((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    );
  }

  function selectVisible() {
    const visibleCodes = filtered.map(getCode);
    const allSelected =
      visibleCodes.length > 0 &&
      visibleCodes.every((code) => selected.includes(code));

    setSelected((current) =>
      allSelected
        ? current.filter((code) => !visibleCodes.includes(code))
        : [...new Set([...current, ...visibleCodes])]
    );
  }

  function openBulkSearch() {
    const chosen = products.filter((product) =>
      selected.includes(getCode(product))
    );

    if (!chosen.length) {
      setError("Pehle products select kar.");
      setMessage("");
      return;
    }

    setError("");
    setMessage(
      `${chosen.length} products selected. Google Images search khulne par har product ki direct image URL copy karna.`
    );

    const query = chosen
      .map((product) =>
        [
          product.brand,
          getCode(product),
          product.color || product.colour,
          product.category,
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join(" OR ");

    window.open(
      `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function saveBulkImages() {
    setError("");
    setMessage("");

    const lines = imageLines
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      setError("Pehle image URLs paste kar.");
      return;
    }

    const urlMap = new Map();
    const problems = [];

    lines.forEach((line, index) => {
      const comma = line.indexOf(",");

      if (comma === -1) {
        problems.push(`Line ${index + 1}: code aur URL ke beech comma lagao.`);
        return;
      }

      const code = line.slice(0, comma).trim();
      const url = line.slice(comma + 1).trim();

      if (!code || !isValidImageUrl(url)) {
        problems.push(`Line ${index + 1}: product code ya URL invalid hai.`);
        return;
      }

      urlMap.set(code.toLowerCase(), url);
    });

    const knownCodes = new Set(
      products.map((product) => getCode(product).toLowerCase())
    );

    for (const code of urlMap.keys()) {
      if (!knownCodes.has(code)) {
        problems.push(`Inventory mein product code nahi mila: ${code}`);
      }
    }

    if (problems.length) {
      setError(problems.slice(0, 8).join("\n"));
      return;
    }

    let updatedCount = 0;

    const next = products.map((product) => {
      const url = urlMap.get(getCode(product).toLowerCase());
      if (!url) return product;

      updatedCount += 1;
      return { ...product, image: url };
    });

    updateProducts(next);
    setImageLines("");
    setMessage(`${updatedCount} product image URLs save ho gaye.`);
  }

  function exportImageSheet() {
    const rows = [
      ["code", "brand", "name", "category", "color", "imageURL"],
      ...products.map((product) => [
        getCode(product),
        product.brand || "",
        product.name || "",
        product.category || "",
        product.color || product.colour || "",
        product.image || "",
      ]),
    ];

    downloadWorkbook(
      rows,
      "deep-handloom-image-mapping.xlsx",
      "Image Mapping"
    );
  }

  function exportInventory() {
    const rows = [
      [
        "code",
        "name",
        "brand",
        "category",
        "sizes",
        "price",
        "discountPrice",
        "discountPercent",
        "inStock",
        "image",
        "color",
      ],
      ...products.map((product) => [
        getCode(product),
        product.name || "",
        product.brand || "",
        product.category || "",
        (product.sizes || []).join(","),
        product.price ?? 0,
        product.discountPrice ?? product.price ?? 0,
        product.discountPercent ?? 0,
        product.inStock ? "TRUE" : "FALSE",
        product.image || "",
        product.color || product.colour || "",
      ]),
    ];

    downloadWorkbook(rows, "deep-handloom-inventory-backup.xlsx", "Products");
    setMessage("Inventory backup download ho gaya.");
    setError("");
  }

  function restoreDemo() {
    if (
      !window.confirm(
        "Current inventory replace karke demo products restore karein?"
      )
    ) {
      return;
    }

    updateProducts(productsData);
    setSelected([]);
    setMessage("Demo products restore ho gaye.");
    setError("");
  }

  const card = {
    background: "#fff",
    border: "1px solid #e5e2d9",
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  };

  const button = {
    border: "1px solid #d8d5ca",
    background: "#fff",
    color: "#292a24",
    borderRadius: 8,
    padding: "10px 13px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  };

  const input = {
    border: "1px solid #d8d5ca",
    borderRadius: 8,
    padding: "11px 12px",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  };

  const remoteImageCount = products.filter((product) =>
    /^https?:\/\//i.test(product.image || "")
  ).length;

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "28px 20px",
        color: "#24251f",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div>
          <p style={{ color: "#77776d", fontSize: 12, letterSpacing: 1 }}>
            DEEP HANDLOOM / ADMIN
          </p>
          <h1 style={{ margin: 0, fontSize: 30 }}>Inventory</h1>
          <p style={{ color: "#77776d", fontSize: 13 }}>
            Excel inventory aur bulk product images.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={button} onClick={downloadTemplate}>
            Download Excel Template
          </button>
          <button style={button} onClick={exportInventory}>
            Backup Inventory
          </button>
        </div>
      </div>

      <section
        style={{
          ...card,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <small>Total products</small>
          <h2>{products.length}</h2>
        </div>
        <div>
          <small>Available</small>
          <h2>{products.filter((p) => p.inStock).length}</h2>
        </div>
        <div>
          <small>Out of stock</small>
          <h2>{products.filter((p) => !p.inStock).length}</h2>
        </div>
        <div>
          <small>Remote image URLs</small>
          <h2>{remoteImageCount}</h2>
        </div>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 19, marginTop: 0 }}>1. Import Excel</h2>
        <p style={{ color: "#77776d", fontSize: 13, lineHeight: 1.6 }}>
          Excel import current inventory ko replace karta hai. Matching product
          codes ki existing images preserve hoti hain. Import se pehle backup
          download kar lena.
        </p>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImport}
          disabled={busy}
        />

        {busy && <p>Import ho raha hai...</p>}

        <div style={{ marginTop: 16 }}>
          <button style={button} onClick={restoreDemo}>
            Restore Demo Products
          </button>
        </div>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 19, marginTop: 0 }}>2. Bulk Image Matching</h2>
        <p style={{ color: "#77776d", fontSize: 13, lineHeight: 1.6 }}>
          Products select karo, Google Images search kholo aur har product ki
          direct image URL copy karo. Har line ka format: product code, comma,
          image URL.
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <button style={button} onClick={selectVisible}>
            Select / Deselect Visible
          </button>
          <button
            style={button}
            onClick={() => setSelected(filtered.map(getCode))}
          >
            Select All Visible
          </button>
          <button style={button} onClick={() => setSelected([])}>
            Clear Selection
          </button>
          <button style={button} onClick={openBulkSearch}>
            Search Selected Products ↗
          </button>
          <button style={button} onClick={exportImageSheet}>
            Export Image Mapping
          </button>
        </div>

        <p style={{ fontSize: 13 }}>
          Selected: <strong>{selected.length}</strong>
        </p>

        <label
          htmlFor="bulk-urls"
          style={{
            display: "block",
            fontWeight: 600,
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          Paste multiple image URLs
        </label>

        <textarea
          id="bulk-urls"
          style={{
            ...input,
            minHeight: 150,
            fontFamily: "monospace",
            lineHeight: 1.6,
          }}
          value={imageLines}
          onChange={(event) => setImageLines(event.target.value)}
          placeholder={
            "MF-001, https://example.com/shirt.jpg\nRD-001, https://example.com/redtape.jpg"
          }
        />

        <div style={{ marginTop: 12 }}>
          <button
            style={{ ...button, background: "#252720", color: "#fff" }}
            onClick={saveBulkImages}
          >
            Save All Image URLs
          </button>
        </div>

        <p style={{ color: "#77776d", fontSize: 12, lineHeight: 1.6 }}>
          Google Images result page ka URL direct product image URL nahi hota.
          Image address copy karo. Kuch websites direct image loading block
          karti hain; save karne ke baad preview check karna.
        </p>
      </section>

      {(message || error) && (
        <div
          style={{
            ...card,
            borderColor: error ? "#e4b6b2" : "#b9d8c1",
            whiteSpace: "pre-wrap",
            color: error ? "#a52822" : "#267345",
          }}
        >
          {error || message}
        </div>
      )}

      <section style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h2 style={{ fontSize: 20 }}>3. Product List</h2>
          <input
            style={{ ...input, maxWidth: 300 }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code, brand, product..."
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 850,
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: "#f7f6f1", textAlign: "left" }}>
                {[
                  "Select",
                  "Product",
                  "Code",
                  "Brand",
                  "Price",
                  "Stock",
                  "Image",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: 11,
                      borderBottom: "1px solid #e5e2d9",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filtered.map((product) => {
                const code = getCode(product);
                const hasRemoteImage = /^https?:\/\//i.test(
                  product.image || ""
                );

                return (
                  <tr key={code}>
                    <td style={{ padding: 11, borderBottom: "1px solid #eee" }}>
                      <input
                        type="checkbox"
                        checked={selected.includes(code)}
                        onChange={() => toggleProduct(code)}
                        aria-label={`Select ${code}`}
                      />
                    </td>

                    <td style={{ padding: 11, borderBottom: "1px solid #eee" }}>
                      <strong>{product.name}</strong>
                      <div style={{ color: "#77776d" }}>
                        {product.category}
                        {product.color ? ` · ${product.color}` : ""}
                      </div>
                    </td>

                    <td style={{ padding: 11, borderBottom: "1px solid #eee" }}>
                      {code}
                    </td>

                    <td style={{ padding: 11, borderBottom: "1px solid #eee" }}>
                      {product.brand}
                    </td>

                    <td style={{ padding: 11, borderBottom: "1px solid #eee" }}>
                      ₹
                      {Number(
                        product.discountPrice ?? product.price ?? 0
                      ).toLocaleString("en-IN")}
                    </td>

                    <td
                      style={{
                        padding: 11,
                        borderBottom: "1px solid #eee",
                        color: product.inStock ? "#267345" : "#b42318",
                      }}
                    >
                      {product.inStock ? "Available" : "Out of stock"}
                    </td>

                    <td style={{ padding: 11, borderBottom: "1px solid #eee" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {hasRemoteImage && (
                          <img
                            src={product.image}
                            alt=""
                            style={{
                              width: 42,
                              height: 52,
                              objectFit: "cover",
                              borderRadius: 4,
                            }}
                          />
                        )}

                        <div>
                          <div style={{ fontSize: 12 }}>
                            {hasRemoteImage ? "URL saved" : "No remote URL"}
                          </div>
                          <button
                            style={{
                              ...button,
                              padding: "6px 8px",
                              marginTop: 5,
                            }}
                            onClick={() =>
                              window.open(
                                imageSearchUrl(product),
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            Find ↗
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filtered.length && (
                <tr>
                  <td colSpan={7} style={{ padding: 22, textAlign: "center" }}>
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
