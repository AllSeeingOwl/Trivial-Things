// Tailwind for this app is prebuilt into static/css/tailwind.css by tools/frontend/build.sh
// (it used to be generated in the browser by cdn.tailwindcss.com).
module.exports = {
  content: [__dirname + '/templates/**/*.html', __dirname + '/static/js/**/*.js'],
};
