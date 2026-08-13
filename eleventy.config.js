export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Wrap Markdown tables so wide ones scroll inside their own box rather
  // than making the page scroll sideways.
  eleventyConfig.amendLibrary("md", (md) => {
    const openFn = md.renderer.rules.table_open;
    const closeFn = md.renderer.rules.table_close;
    md.renderer.rules.table_open = (tokens, i, opts, env, self) =>
      '<div class="table-wrap">' +
      (openFn ? openFn(tokens, i, opts, env, self) : self.renderToken(tokens, i, opts));
    md.renderer.rules.table_close = (tokens, i, opts, env, self) =>
      (closeFn ? closeFn(tokens, i, opts, env, self) : self.renderToken(tokens, i, opts)) +
      "</div>";
  });

  // Games sorted by title, for the index page.
  eleventyConfig.addCollection("games", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/games/*.md")
      .sort((a, b) => a.data.title.localeCompare(b.data.title))
  );

  // The PDF that scripts/build-pdfs.mjs renders for a given game page.
  eleventyConfig.addFilter("pdfUrl", (url) => `${url.replace(/\/$/, "")}.pdf`);

  return {
    pathPrefix: process.env.PATH_PREFIX || "/",
    markdownTemplateEngine: "njk",
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
  };
}
