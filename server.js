const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security Headers Middleware ---
app.use(function(req, res, next) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Enable XSS filter in older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Content Security Policy
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://ajax.googleapis.com https://cdn.jsdelivr.net https://www.gstatic.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.cloudfunctions.net wss://*.firebaseio.com; " +
        "frame-src 'self' https://*.firebaseapp.com;"
    );
    next();
});

// Restrict CORS to same-origin only (no wildcard)
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (same-origin, mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        var allowedOrigins = [
            'http://localhost:' + PORT,
            'http://127.0.0.1:' + PORT
        ];
        // Allow Vercel deployment URLs
        if (origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(express.json({ limit: '10kb' })); // Limit body size to prevent abuse
app.use(express.static(path.join(__dirname, 'public')));

// All other requests serve the index.html for AngularJS HTML5 mode
app.use(function(req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, function() {
    console.log('Server is running on http://localhost:' + PORT);
});
