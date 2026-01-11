const app = require('./app');

console.log("VALEUR DE process.env.PORT :", process.env.PORT);
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});