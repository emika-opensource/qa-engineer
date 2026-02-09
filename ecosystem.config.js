module.exports = {
    apps: [{
        name: 'qa-dashboard',
        script: 'server.js',
        cwd: __dirname,
        env: {
            NODE_ENV: 'production',
            PORT: 3000,
        },
        instances: 1,
        autorestart: true,
        max_restarts: 10,
        restart_delay: 3000,
        watch: false,
        max_memory_restart: '256M',
    }]
};
