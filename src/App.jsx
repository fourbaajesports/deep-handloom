
import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import "./App.css";
import productsData from "./data/products";
import Inventory from "./pages/Inventory";

const STORAGE_KEY = "deepHandloomProducts";

const categories = [
  "All",
  "Shirts",
  "T-Shirts",
  "Jeans & Trousers",
  "Ethnic Wear",
];


const TEST_PRODUCT_IMAGES = {
  "MF-001":
    "https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcTjh4f2hDApqwomlDGj9AxZsMT3ZiymkqCdUg_lMWCsrPnsmgWcG67uBXD3Y3S0JHMJl-H-feP-9HiaCIhgIVNkYyL6ePNDa8tMorhgJyMe",
};


function normalizeProduct(product, index) {
  const price = Number(product.price) || 0;
  const discountPrice = Number(product.discountPrice) || price;
  const code = String(product.code || "").trim().toUpperCase();

  return {
    ...product,
    id: product.id ?? product.code ?? `product-${index}`,
    price,
    discountPrice,
    discountPercent:
      Number(product.discountPercent) ||
      (price > discountPrice
        ? Math.round(((price - discountPrice) / price) * 100)
        : 0),
    sizes: Array.isArray(product.sizes)
      ? product.sizes
      : String(product.sizes || "")
          .split(",")
          .map((size) => size.trim())
          .filter(Boolean),
    image:
      TEST_PRODUCT_IMAGES[code] ||
      product.image ||
      `/products/${product.code}.jpg`,
    inStock:
      product.inStock === false ||
      String(product.inStock).toLowerCase() === "false"
        ? false
        : true,
  };
}

function getInitialProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        return parsed.map(normalizeProduct);
      }
    }
  } catch (error) {
    console.error("Could not read saved products:", error);
  }

  return productsData.map(normalizeProduct);
}

function HomePage() {
  const [products, setProducts] = useState(getInitialProducts);
  const [category, setCategory] = useState("All");
  const [brand, setBrand] = useState("All");
  const [size, setSize] = useState("All");
  const [maxPrice, setMaxPrice] = useState(10000);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [sort, setSort] = useState("featured");

  useEffect(() => {
    const refreshProducts = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
          const parsed = JSON.parse(saved);

          if (Array.isArray(parsed)) {
            setProducts(parsed.map(normalizeProduct));
          }
        }
      } catch (error) {
        console.error("Could not refresh products:", error);
      }
    };

    window.addEventListener("deepHandloomProductsUpdated", refreshProducts);
    window.addEventListener("storage", refreshProducts);

    return () => {
      window.removeEventListener("deepHandloomProductsUpdated", refreshProducts);
      window.removeEventListener("storage", refreshProducts);
    };
  }, []);

  const brands = useMemo(
    () => [
      "All",
      ...new Set(products.map((product) => product.brand).filter(Boolean)),
    ],
    [products]
  );

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesCategory =
        category === "All" || product.category === category;
      const matchesBrand = brand === "All" || product.brand === brand;
      const matchesSize = size === "All" || product.sizes.includes(size);
      const matchesPrice = product.discountPrice <= maxPrice;
      const matchesDiscount =
        !discountOnly || product.discountPrice < product.price;

      return (
        matchesCategory &&
        matchesBrand &&
        matchesSize &&
        matchesPrice &&
        matchesDiscount
      );
    });

    if (sort === "price-low") {
      result = [...result].sort(
        (a, b) => a.discountPrice - b.discountPrice
      );
    } else if (sort === "price-high") {
      result = [...result].sort(
        (a, b) => b.discountPrice - a.discountPrice
      );
    } else if (sort === "discount") {
      result = [...result].sort(
        (a, b) => b.discountPercent - a.discountPercent
      );
    }

    return result;
  }, [products, category, brand, size, maxPrice, discountOnly, sort]);

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const resetFilters = () => {
    setCategory("All");
    setBrand("All");
    setSize("All");
    setMaxPrice(10000);
    setDiscountOnly(false);
    setSort("featured");
  };

  return (
    <div className="site">
      <div className="announcement">
        WELCOME TO DEEP HANDLOOM · EXPLORE YOUR STYLE
      </div>

      <header className="header">
        <a className="logo" href="#home">
          <span className="logo-name">DEEP HANDLOOM</span>
          <span className="logo-subtitle">FASHION FOR EVERY DAY</span>
        </a>

        <nav className="nav">
          <a href="#home">Home</a>
          <a href="#products">All Products</a>
          <a href="#brands">Brands</a>
          <a href="#offers">Offers</a>
        </nav>

        <a className="header-link" href="#products">
          Explore Collection ↗
        </a>
      </header>

      <main>
        <section className="intro" id="home">
          <p className="eyebrow">YOUR STYLE. YOUR CHOICE.</p>

          <h1>
            Find your
            <br />
            <span>everyday favourite.</span>
          </h1>

          <p className="intro-text">
            Discover clothing from brands you love, all in one place.
            Find your fit, explore new styles and check the latest offers.
          </p>

          <div className="intro-actions">
            <a className="button button-dark" href="#products">
              Shop Collection <span>↗</span>
            </a>

            <a className="text-link" href="#offers">
              View Latest Offers ↗
            </a>
          </div>

          <div className="intro-note">
            <span className="status-dot" />
            MULTIPLE BRANDS · ONE DESTINATION
          </div>
        </section>

        <section className="section product-section" id="products">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE COLLECTION</p>
              <h2>Find your fit.</h2>
              <p className="muted">
                Explore products across all available brands.
              </p>
            </div>

            <span className="product-count">
              {filteredProducts.length} products
            </span>
          </div>

          <div className="category-tabs">
            {categories.map((item) => (
              <button
                key={item}
                className={category === item ? "tab active" : "tab"}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="catalog-layout">
            <aside className="filters">
              <div className="filter-heading">
                <h3>Filters</h3>
                <button className="clear-button" onClick={resetFilters}>
                  Clear all
                </button>
              </div>

              <label className="filter-label" htmlFor="brand">
                Brand
              </label>
              <select
                id="brand"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
              >
                {brands.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <label className="filter-label" htmlFor="size">
                Size
              </label>
              <select
                id="size"
                value={size}
                onChange={(event) => setSize(event.target.value)}
              >
                {["All", "S", "M", "L", "XL", "XXL"].map((item) => (
                  <option key={item} value={item}>
                    {item === "All" ? "All sizes" : item}
                  </option>
                ))}
              </select>

              <div className="filter-label price-label">
                Maximum price
                <strong>{formatPrice(maxPrice)}</strong>
              </div>

              <input
                className="price-slider"
                type="range"
                min="500"
                max="10000"
                step="500"
                value={maxPrice}
                onChange={(event) => setMaxPrice(Number(event.target.value))}
                aria-label="Maximum price"
              />

              <label className="discount-toggle">
                <input
                  type="checkbox"
                  checked={discountOnly}
                  onChange={(event) =>
                    setDiscountOnly(event.target.checked)
                  }
                />
                <span>Discounted products only</span>
              </label>

              <label className="filter-label" htmlFor="sort">
                Sort by
              </label>
              <select
                id="sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="discount">Highest discount</option>
              </select>
            </aside>

            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-image">
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";

                        const placeholder =
                          event.currentTarget.nextElementSibling;

                        if (placeholder) {
                          placeholder.style.display = "flex";
                        }
                      }}
                    />

                    <div className="image-placeholder">
                      <span>DEEP HANDLOOM</span>
                      <strong>{product.code}</strong>
                      <small>Product photo coming soon</small>
                    </div>

                    {product.discountPrice < product.price && (
                      <span className="discount-badge">
                        {product.discountPercent}% OFF
                      </span>
                    )}
                  </div>

                  <div className="product-info">
                    <p className="product-brand">{product.brand}</p>
                    <h3>{product.name}</h3>

                    <div className="product-prices">
                      <strong>{formatPrice(product.discountPrice)}</strong>

                      {product.discountPrice < product.price && (
                        <del>{formatPrice(product.price)}</del>
                      )}
                    </div>

                    <div className="product-sizes">
                      {product.sizes.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>

                    <p
                      className={
                        product.inStock ? "stock in-stock" : "stock out-stock"
                      }
                    >
                      {product.inStock
                        ? "Available in store"
                        : "Out of stock"}
                    </p>
                  </div>
                </article>
              ))}

              {filteredProducts.length === 0 && (
                <div className="empty-results">
                  <h3>No matching products</h3>
                  <p>Try changing your filters to see more products.</p>
                  <button
                    className="button button-dark"
                    onClick={resetFilters}
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="collection section" id="brands">
          <div>
            <p className="eyebrow">A WORLD OF CHOICE</p>
            <h2>
              All your favourite brands.
              <br />
              All in one place.
            </h2>
            <p>
              Browse different brands together and find clothing that fits
              your style and budget.
            </p>
          </div>

          <a className="button button-light" href="#products">
            Browse Products <span>↗</span>
          </a>
        </section>

        <section className="offers section" id="offers">
          <div>
            <p className="eyebrow">SPECIAL DEALS</p>
            <h2>
              Good finds.
              <br />
              Better prices.
            </h2>
            <p className="muted">
              Browse discounted products and discover special offers.
            </p>
          </div>

          <button
            className="button button-dark"
            onClick={() => {
              setDiscountOnly(true);
              document
                .getElementById("products")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            View Discounted Products <span>↗</span>
          </button>
        </section>
      </main>

      <footer className="footer">
        <a className="logo footer-logo" href="#home">
          <span className="logo-name">DEEP HANDLOOM</span>
          <span className="logo-subtitle">FASHION FOR EVERY DAY</span>
        </a>

        <p>Discover your style, all in one place.</p>
        <span>© {new Date().getFullYear()} Deep Handloom</span>
      </footer>

      <div style={{ padding: "12px 7%", textAlign: "right" }}>
        <Link to="/admin/inventory" className="text-link">
          Inventory Admin ↗
        </Link>
      </div>
    </div>
  );
}

function InventoryPage() {
  const navigate = useNavigate();

  return (
    <>
      <div
        style={{
          padding: "18px 7%",
          borderBottom: "1px solid #e5e2d9",
        }}
      >
        <Link to="/" className="text-link">
          ← Back to Store
        </Link>
      </div>

      <Inventory />

      <div style={{ padding: "18px 7%" }}>
        <button
          type="button"
          className="button button-dark"
          onClick={() => navigate("/")}
        >
          Return to Store
        </button>
      </div>
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin/inventory" element={<InventoryPage />} />

      <Route
        path="*"
        element={
          <main style={{ padding: "60px 7%" }}>
            <h1>Page not found</h1>
            <Link to="/" className="text-link">
              Return to homepage
            </Link>
          </main>
        }
      />
    </Routes>
  );
}

export default App;
