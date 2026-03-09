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

        // collect raw text and normalize whitespace but keep newlines
        let rawText = cell.text().replace(/[ \t]+/g, ' ').trim();
        // reduce multiple newlines and blank lines to single newline
        rawText = rawText.replace(/\n\s*\n+/g, '\n');
        const dateMatch = rawText.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
        if (!dateMatch) continue;
        const [_, dateStr, timeStr] = dateMatch;
        const [day, month, year] = dateStr.split('/');
        const [hour, minute] = timeStr.split(':');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
        const dateISO = dateObj.toISOString();

        // remove the date/time from the text
        let afterDate = rawText.replace(dateMatch[0], '').trim();
        let sender = null;
        let body = afterDate;
        let userMessage = null;
        let responseMessage = null;
        let reply = null;
        let attachmentLink = null;
        let fullBodyLink = null;

        // if there's a structured span with the name, use it
        const nameSpan = cell.find('span.ia-name');
        if (nameSpan.length > 0) {
          sender = nameSpan.text().trim();
          if (body.startsWith(sender)) {
            body = body.slice(sender.length).trim();
          }
          // strip any leading punctuation/colon from the remainder
          body = body.replace(/^[:\-–—\s]+/, '').trim();
        }

        // now, check for message-body structure
        const messageBody = cell.find('.message-body');
        if (messageBody.length > 0) {
          const clampTexts = messageBody.find('.clamp-text');
          clampTexts.each((i, el) => {
            const $el = $(el);
            const text = $el.text().trim();
            if ($el.hasClass('message-response')) {
              responseMessage = text.replace(/^Réponse:\s*/, '').trim();
            } else if (text.startsWith('Émetteur:')) {
              userMessage = text.replace(/^Émetteur:\s*/, '').trim();
            }
          });
          // set reply to the response if present
          reply = responseMessage;
          // find fullBodyLink from button
          const voirPlusBtn = messageBody.find('.voir-plus-btn');
          if (voirPlusBtn.length > 0) {
            let href = voirPlusBtn.attr('data-href');
            if (href && href.startsWith('/')) {
              href = `https://megamail25.com${href}`;
            }
            fullBodyLink = href;
          }
        } else {
          // fallback: try extracting sender up to the first colon
          const senderMatch = afterDate.match(/^([^:\n]+):\s*(.*)/);
          if (senderMatch) {
            sender = senderMatch[1].trim();
            body = senderMatch[2].trim();
          } else {
            const parts = afterDate.split(' ');
            sender = parts.shift();
            body = parts.join(' ').trim();
          }
        }


        // links for attachment
        const attachAnchor = cell.find('a:contains("Pièce jointe")');
        if (attachAnchor.length > 0) {
          attachmentLink = attachAnchor.attr('href') || null;
          if (attachmentLink && attachmentLink.startsWith('/')) {
            attachmentLink = `https://megamail25.com${attachmentLink}`;
          }
        }



        const message = {
          dateISO,
          date: dateStr,   // original format DD/MM/YYYY
          time: timeStr,   // original HH:MM
          sender,
          body: userMessage || body,
          userMessage,
          iconUrl,
          type,
          attachmentLink,
          fullBodyLink,
          reply
        };
        // Clean body
        let finalBody = message.body;
        finalBody = finalBody.replace(/\s*Pièce jointe\s*$/i, '');
        finalBody = finalBody.replace(/\s*Voir plus\s*$/i, '');
        // trim whitespace around newlines
        finalBody = finalBody.replace(/\n\s+/g, '\n').replace(/\s+\n/g, '\n');
        finalBody = finalBody.trim();
        message.body = finalBody;
        // Avoid duplication: if reply is contained in body, clear it
        const normalizedBody = message.body.replace(/\s+/g, ' ').trim();
        const normalizedReply = message.reply.replace(/\s+/g, ' ').trim();
        if (normalizedBody.includes(normalizedReply)) {
          message.reply = null;
        }
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
  // write version info
  const versionInfo = {
    lastUpdated: new Date().toISOString(),
    messageCount: messages.length
  };
  fs.writeFileSync('version.json', JSON.stringify(versionInfo, null, 2), 'utf-8');
  console.log('Scraping complete. Data saved to data.json and version.json');
}

main();