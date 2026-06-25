export function initSplash() {
    const statusMessages = [
        'Checking Configuration...',
        'Checking Local Database...',
        'Loading Interface...'
    ];

    const statusElement = document.getElementById('splash-status');

    let index = 0;

    function next() {
        if (statusElement && index < statusMessages.length) {
            statusElement.textContent = statusMessages[index];
            index++;
            setTimeout(next, 500);
        }
    }

    next();

    setTimeout(() => {
        if (window.router) {
            window.router.navigate('/login');
        }
    }, 2500);
}
