export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("src/manifest.webmanifest");

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

  eleventyConfig.addCollection("games", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/games/*.md")
      .sort((a, b) => a.data.title.localeCompare(b.data.title))
  );

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
