(function () {
  "use strict";

  function initAnalytics() {
    var _paq = (window._paq = window._paq || []);
    _paq.push(["trackPageView"]);
    _paq.push(["enableLinkTracking"]);

    var base = "https://analytics.yearg.in/";
    _paq.push(["setTrackerUrl", base + "matomo.php"]);
    _paq.push(["setSiteId", "13"]);

    var script = document.createElement("script");
    script.async = true;
    script.src = base + "matomo.js";

    var firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function recipeTotals(recipe) {
    var installs = Number(recipe && recipe.stats && recipe.stats.installs) || 0;
    var forks = Number(recipe && recipe.stats && recipe.stats.forks) || 0;
    return {
      installs: installs,
      forks: forks,
      total: installs + forks,
    };
  }

  function screenshotMarkup(recipe) {
    var screenshot = recipe.local_screenshot_url || recipe.screenshot_url || "";
    var screenshotUrl = "";

    if (screenshot) {
      screenshotUrl = new URL(screenshot, window.location.href).href;
    }

    return [
      "<style>",
      "html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }",
      ".preview-content { width: 100%; height: 100%; overflow: hidden; background: #fff; }",
      ".preview-image { width: 100%; height: 100%; display: block; object-fit: cover; }",
      "</style>",
      '<div class="preview-content">',
      '<img class="preview-image" src="' +
        escapeHtml(screenshotUrl) +
        '" alt="' +
        escapeHtml(recipe.name) +
        ' screenshot">',
      "</div>",
    ].join("");
  }

  function recipeRowsMarkup(recipes) {
    return recipes
      .map(function (recipe, index) {
        var totals = recipeTotals(recipe);
        var description =
          (recipe.author_bio && recipe.author_bio.description) || "";
        var github = (recipe.author_bio && recipe.author_bio.github_url) || "";
        var trmnl = "https://trmnl.com/recipes/" + recipe.id;

        return [
          '<tr role="button" tabindex="0" data-recipe-id="' +
            recipe.id +
            '" aria-label="Show screenshot for ' +
            escapeHtml(recipe.name) +
            '">',
          "<td>" + (index + 1) + "</td>",
          "<td>",
          '<div class="recipe-name">' + escapeHtml(recipe.name) + "</div>",
          '<div class="recipe-description">' +
            escapeHtml(description) +
            "</div>",
          "</td>",
          "<td>" + totals.installs + "</td>",
          "<td>" + totals.forks + "</td>",
          "<td>" + totals.total + "</td>",
          '<td><a class="table-link" href="' +
            escapeHtml(trmnl) +
            '" target="_blank" rel="noopener noreferrer">Recipe</a>' +
            (github
              ? ' <a class="table-link" href="' +
                escapeHtml(github) +
                '" target="_blank" rel="noopener noreferrer">GitHub</a>'
              : "-") +
            "</td>",
          "</tr>",
        ].join("");
      })
      .join("");
  }

  function sortRecipes(recipes) {
    recipes.sort(function (a, b) {
      return recipeTotals(b).total - recipeTotals(a).total;
    });
    return recipes;
  }

  function hasScreenshot(recipe) {
    return Boolean(recipe && (recipe.local_screenshot_url || recipe.screenshot_url));
  }

  function pickDefaultRecipe(recipes) {
    return recipes[0];
  }

  async function fetchRecipes() {
    var response = await fetch("./recipes.json");
    if (!response.ok) {
      throw new Error("recipes.json request failed with status " + response.status);
    }

    var payload = await response.json();
    var recipes = Array.isArray(payload.data) ? payload.data.slice() : [];
    return sortRecipes(recipes).filter(hasScreenshot);
  }

  function updateSelectedRow(tableBody, selectedId) {
    Array.from(tableBody.querySelectorAll("tr")).forEach(function (row) {
      var isSelected = row.getAttribute("data-recipe-id") === selectedId;
      row.classList.toggle("active", isSelected);
      row.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function createSelector(recipes, frame, tableBody, status) {
    return function selectRecipe(recipeId, shouldScroll) {
      var selected = recipes.find(function (recipe) {
        return String(recipe.id) === String(recipeId);
      });

      if (!selected) {
        return;
      }

      frame.setHTML(screenshotMarkup(selected));
      status.textContent = "Viewing screenshot: " + selected.name;

      if (shouldScroll) {
        frame.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      updateSelectedRow(tableBody, String(selected.id));
    };
  }

  async function initDashboard() {
    var status = document.getElementById("status");
    var tableBody = document.getElementById("recipes-body");
    var frame = document.querySelector("trmnl-frame");

    if (!status || !tableBody || !frame || typeof frame.setHTML !== "function") {
      return;
    }

    status.textContent = "Loading recipes...";

    try {
      var recipes = await fetchRecipes();
      if (!recipes.length) {
        status.textContent = "No recipes with screenshots found.";
        return;
      }

      tableBody.innerHTML = recipeRowsMarkup(recipes);
      var selectRecipe = createSelector(recipes, frame, tableBody, status);

      tableBody.addEventListener("click", function (event) {
        if (event.target.closest("a")) {
          return;
        }

        var row = event.target.closest("tr[data-recipe-id]");
        if (row) {
          selectRecipe(row.getAttribute("data-recipe-id"), true);
        }
      });

      tableBody.addEventListener("keydown", function (event) {
        var row = event.target.closest("tr[data-recipe-id]");
        if (!row) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectRecipe(row.getAttribute("data-recipe-id"), true);
        }
      });

      selectRecipe(pickDefaultRecipe(recipes).id, false);
    } catch (error) {
      status.textContent = "Unable to load recipe data right now.";
      console.error(error);
    }
  }

  async function start() {
    initAnalytics();

    if (window.customElements && typeof window.customElements.whenDefined === "function") {
      await window.customElements.whenDefined("trmnl-frame");
    }

    initDashboard();
  }

  document.addEventListener("DOMContentLoaded", function () {
    start().catch(function (error) {
      console.error("Dashboard bootstrap failed:", error);
    });
  });
})();
