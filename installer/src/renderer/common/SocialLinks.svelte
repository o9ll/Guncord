<script>
    import {tooltip} from "./tooltip";
    
    const telegramUrl = "https://t.me/nuncord";
    const githubUrl = "https://github.com/o9ll/Guncord";
    const webUrl = "https://github.com/o9ll";
</script>

<div class="social-links">
    <!-- GitHub -->
    <a use:tooltip={{text: "GitHub"}} aria-label="GitHub" class="social" id="github" target="_blank" href={githubUrl}>
        <svg tabindex="-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <path d="M16 .8C7.6.8.8 7.6.8 16c0 6.7 4.3 12.4 10.3 14.4.8.1 1.1-.3 1.1-.8v-2.8c-4.2.9-5.1-1.8-5.1-1.8-.7-1.7-1.7-2.2-1.7-2.2-1.4-.9.1-.9.1-.9 1.5.1 2.3 1.6 2.3 1.6 1.4 2.3 3.6 1.7 4.5 1.3.1-1 .5-1.7 1-2-3.3-.4-6.8-1.7-6.8-7.5 0-1.7.6-3 1.6-4.1-.2-.4-.7-1.9.2-4 0 0 1.3-.4 4.2 1.6 1.2-.3 2.5-.5 3.8-.5s2.6.2 3.8.5c2.9-2 4.2-1.6 4.2-1.6.8 2.1.3 3.6.2 4 1 1.1 1.6 2.4 1.6 4.1 0 5.8-3.5 7.1-6.8 7.5.5.5 1 1.4 1 2.9v4.3c0 .5.3.9 1.1.8C26.9 28.4 31.2 22.7 31.2 16 31.2 7.6 24.4.8 16 .8z"/>
        </svg>
    </a>

    <!-- Telegram Support -->
    <a use:tooltip={{text: "Telegram Channel"}} aria-label="Telegram Channel" class="social" id="telegram" target="_blank" href={telegramUrl}>
        <svg tabindex="-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <path d="M22.122 10.040c0.006-0 0.014-0 0.022-0 0.209 0 0.403 0.065 0.562 0.177l-0.003-0.002c0.116 0.101 0.194 0.243 0.213 0.403l0 0.003c0.020 0.122 0.031 0.262 0.031 0.405 0 0.065-0.002 0.129-0.007 0.193l0-0.009c-0.225 2.369-1.201 8.114-1.697 10.766-0.21 1.123-0.623 1.499-1.023 1.535-0.869 0.081-1.529-0.574-2.371-1.126-1.318-0.865-2.063-1.403-3.342-2.246-1.479-0.973-0.52-1.51 0.322-2.384 0.221-0.23 4.052-3.715 4.127-4.031 0.004-0.019 0.006-0.040 0.006-0.062 0-0.078-0.029-0.149-0.076-0.203l0 0c-0.052-0.034-0.117-0.053-0.185-0.053-0.045 0-0.088 0.009-0.128 0.024l0.002-0.001q-0.198 0.045-6.316 4.174c-0.445 0.351-1.007 0.573-1.619 0.599l-0.006 0c-0.867-0.105-1.654-0.298-2.401-0.573l0.074 0.024c-0.938-0.306-1.683-0.467-1.619-0.985q0.051-0.404 1.114-0.827 6.548-2.853 8.733-3.761c1.607-0.853 3.47-1.555 5.429-2.010l0.157-0.031zM15.93 1.025c-8.302 0.020-15.025 6.755-15.025 15.060 0 8.317 6.742 15.060 15.060 15.060s15.060-6.742 15.060-15.060c0-8.305-6.723-15.040-15.023-15.060h-0.002q-0.035-0-0.070 0z"/>
        </svg>
    </a>

    <!-- Website -->
    <a use:tooltip={{text: "Website"}} aria-label="Website" class="social" id="web" target="_blank" href={webUrl}>
        <svg tabindex="-1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" aria-hidden="true" viewBox="0 0 1024 1024">
            <defs>
                <linearGradient id="o9Gradient" x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stop-color="#33cfff"/>
                    <stop offset="100%" stop-color="#7b2cff"/>
                </linearGradient>
            </defs>
            <path fill="url(#o9Gradient)" d="M684 238c46 2 89 15 128 41 41 29 71 65 84 114 6 24 7 47 5 72-5 39-21 73-43 105-37 52-70 106-104 159-24 39-48 77-74 115-6 10-15 15-28 14-2-1-55-2-82-9-9-2-10-5-5-13l73-109 44-66 2-6h-20a206 206 0 0 1-102-31c-7-6-8-10-3-18l27-41 13-17c4-5 9-7 15-5 13 4 26 10 40 12 52 9 97-4 130-48 12-15 18-34 20-53 7-66-46-117-99-127-41-7-79 0-112 26-27 21-42 49-45 83-1 22-3 45-9 66-20 67-63 112-129 134-29 11-60 13-92 10-42-3-80-16-114-41a199 199 0 0 1-44-282 210 210 0 0 1 202-84 246 246 0 0 1 66 18c8 3 10 8 6 16l-16 31-9 19c-5 7-11 10-19 8-19-4-38-8-57-6-47 2-85 20-109 62-11 18-15 38-15 59 1 56 42 101 98 111 29 6 58 3 85-10 29-15 48-39 57-71 3-13 4-26 5-39 1-47 17-89 47-124 34-40 78-63 129-72 18-4 36-3 54-3"/>
        </svg>
    </a>
</div>

<style>
    .social-links {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        margin-top: -5px;
        margin-right: -5px;
    }

    .social {
        width: 28px;
        height: 28px;
        margin-top: 5px;
        margin-right: 5px;
        background-color: var(--bg3-alt);
        border-radius: 50%;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: 150ms ease;
        outline: none;
    }

    .social:hover {
        color: var(--text-normal);
    }

    .social:active {
        background-color: var(--bg4);
    }

    .social svg {
        width: 14px;
        height: auto;
        fill: currentColor;
    }
</style>
