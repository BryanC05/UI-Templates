// Update coordinates with current time/location simulation
function updateCoordinates() {
    const coordsElement = document.getElementById('coords');
    if (coordsElement) {
        // Simulate live coordinates updating slightly
        const lat = (40.7128 + (Math.random() - 0.5) * 0.01).toFixed(4);
        const lon = (-74.0060 + (Math.random() - 0.5) * 0.01).toFixed(4);
        coordsElement.textContent = `${lat}° N, ${Math.abs(lon).toFixed(4)}° W`;
    }
}

// Update coordinates every 30 seconds
setInterval(updateCoordinates, 30000);

// Smooth scroll offset for fixed nav
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const navHeight = document.querySelector('.nav').offsetHeight;
            const targetPosition = target.offsetTop - navHeight - 20;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});
