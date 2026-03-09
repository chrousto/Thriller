# Message Viewer

A better version of the message list site, with scraping, search, and static hosting on GitHub Pages.

## Features

- Scrapes messages from the source site, following paging and "Voir plus" links for full bodies
- Detects sender names via `<span class="ia-name">` when available (better accuracy)
- Normalises date/time to ISO so the UI can filter by date range
- Stores and renders real icon images and attachment URLs
- Displays messages with type icon, sender, time, body
- Search by text in body, date range, type, sender
- Displays attachments inline if they are images (or links otherwise)
- Static site, easy to host on GitHub Pages

## Setup

1. Run the scraper: `node scraper.js`
2. Open `index.html` in a browser or host on a server.

## Hosting on GitHub Pages

1. Create a GitHub repository
2. Push the files (index.html, style.css, script.js, data.json, version.json)
3. Enable GitHub Pages in repository settings.

## Updating Data

Run `node scraper.js` to fetch new messages and update `data.json`.  Or rely on the included GitHub Actions workflow, which will run every six hours (and can be triggered manually) to refresh the data and commit changes back to the repository.

### GitHub Actions

A `.github/workflows/scrape.yml` file is included; it installs dependencies, runs the scraper, and commits `data.json` if it changed.  Make sure the repository has write permissions for the action (default for the checkout action).