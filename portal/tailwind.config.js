// Builds portal/styles.css. Regenerate after changing classes in index.html:
//   npx tailwindcss@3.4.17 -c portal/tailwind.config.js -o portal/styles.css --minify
module.exports = {
  content: [__dirname + '/index.html'],
};
