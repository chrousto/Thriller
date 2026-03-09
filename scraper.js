const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const baseUrl = 'https://megamail25.com/322481225923/messages';
let messages = [];
let page = 1;

async function scrapePage(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Find the table
    const table = $('table');
    if (table.length === 0) {
      console.log('No table found');
      return;
    }
    const rows = table.find('tr');
    // use a for loop so we can await inside if needed
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const td = $(row).find('td');
      if (td.length === 1) {
        const cell = td.first();
        // icon
        const img = cell.find('img');
        let iconUrl = null;
        let type = null;
        if (img.length > 0) {
          iconUrl = img.attr('src') || null;
          if (iconUrl && iconUrl.startsWith('/')) {
            iconUrl = `https://megamail25.com${iconUrl}`;
          }
          if (iconUrl) {
            if (iconUrl.includes('telegram')) {
              type = 'telegram';
            } else {
              // derive a type from filename or alt text if available
              const parts = iconUrl.split('/');
              type = parts[parts.length - 1].split('.')[0];
            }
          }
        }

        // collect raw text and normalize whitespace
        const rawText = cell.text().replace(/\s+/g, ' ').trim();
        const dateMatch = rawText.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
        if (!dateMatch) continue;
        const [_, dateStr, timeStr] = dateMatch;
        const [day, month, year] = dateStr.split('/');
        const [hour, minute] = timeStr.split(':');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
        const dateISO = dateObj.toISOString();

        // remove the date/time from the text
        let afterDate = rawText.replace(dateMatch[0], '').trim();
        // take the first token as sender, the rest as body
        let sender = null;
        let body = '';
        if (afterDate.length > 0) {
          const parts = afterDate.split(' ');
          sender = parts.shift();
          body = parts.join(' ').trim();
        }

        // links for attachment and full message
        let attachmentLink = null;
        const attachAnchor = cell.find('a:contains("Pièce jointe")');
        if (attachAnchor.length > 0) {
          attachmentLink = attachAnchor.attr('href') || null;
          if (attachmentLink && attachmentLink.startsWith('/')) {
            attachmentLink = `https://megamail25.com${attachmentLink}`;
          }
        }
        let fullBodyLink = null;
        const fullAnchor = cell.find('a:contains("Voir plus")');
        if (fullAnchor.length > 0) {
          fullBodyLink = fullAnchor.attr('href') || null;
          if (fullBodyLink && fullBodyLink.startsWith('/')) {
            fullBodyLink = `https://megamail25.com${fullBodyLink}`;
          }
        }

        // optionally fetch full body text if link exists
        let fullBodyText = null;
        if (fullBodyLink) {
          try {
            const fbRes = await axios.get(fullBodyLink);
            const $fb = cheerio.load(fbRes.data);
            // naive extraction: take the same table cell or body text
            fullBodyText = $fb('table').text().replace(/\s+/g, ' ').trim();
            if (fullBodyText === '') {
              fullBodyText = $fb('body').text().replace(/\s+/g, ' ').trim();
            }
          } catch (e) {
            console.warn('Failed to fetch full body at', fullBodyLink);
          }
        }

        // check for reply text
        let reply = null;
        if (/Réponse:\s*/i.test(body)) {
          reply = body.split(/Réponse:\s*/i)[1].trim();
        }

        const message = {
          dateISO,
          date: dateStr,   // original format DD/MM/YYYY
          time: timeStr,   // original HH:MM
          sender,
          body: fullBodyText || body,
          iconUrl,
          type,
          attachmentLink,
          fullBodyLink,
          reply
        };
        messages.push(message);
      }
    }
    
    // Check for next page
    const nextLink = $('a:contains("Suivant")').attr('href');
    if (nextLink) {
      page++;
      const nextUrl = `https://megamail25.com${nextLink}`;
      await scrapePage(nextUrl);
    }
  } catch (error) {
    console.error('Error scraping page:', error);
  }
}

async function main() {
  await scrapePage(baseUrl + '?');
  fs.writeFileSync('data.json', JSON.stringify(messages, null, 2), 'utf-8');
  console.log('Scraping complete. Data saved to data.json');
}

main();