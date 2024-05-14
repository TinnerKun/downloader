import axios from 'axios';
import fs from 'fs';

const baseUrl = 'https://www.webtoons.com/th/canvas/path-a-way/list?title_no=xxxxx&page=1';

let title_main = "";
let start_episode = 1;

async function getTitleMain() {
    try {
        const response = await axios.get(baseUrl);
        const titleMainMatch = response.data.match(/<h3 class="subj _challengeTitle">([^<]+)<\/h3>/);
        if (titleMainMatch && titleMainMatch[1]) {
            title_main = titleMainMatch[1];
            title_main = title_main.replace(/[\t\n]/g, '');
            console.log(title_main);
            return title_main;
        } else {
            console.error('Title main not found');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function getLastEpisode() {
    try {
        const response = await axios.get(baseUrl);
        const lastEpisodeUrlMatch = response.data.match(/<a\s+href="([^"]+)"\s+class="NPI=a:list[^>]+>/);
        if (lastEpisodeUrlMatch && lastEpisodeUrlMatch[1]) {
            const lastEpisodeUrl = lastEpisodeUrlMatch[1];
            console.log(lastEpisodeUrl);
            return lastEpisodeUrl;
        } else {
            console.error('Last episode URL not found');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

const getAllEpisodes = async (url) => {
    const episodes = [];
    try {
        let response = await axios.get(url);
        let episodeData = response.data.match(/<li\s+data-episode-no="\d+">\s*<a\s+href="([^"]+)"[^>]+>(.*?)<\/a>/g);
        
        episodeData.forEach((episode) => {
            let match = episode.match(/<li\s+data-episode-no="(\d+)">\s*<a\s+href="([^"]+)"[^>]+>(.*?)<\/a>/);
            if (match && match[1] && match[2]) {
                let title = match[3].replace(/<\/?[^>]+(>|$)/g, "");
                let episodeNumber = parseInt(match[1]);
                if (episodeNumber >= start_episode) {
                    episodes.push({
                        episodeNumber: episodeNumber,
                        episodeTitle: title,
                        episodeURL: match[2]
                    });
                }
            }
        });

        return episodes;
    } catch (error) {
        console.error('Error:', error);
    }
}

const referer = 'https://www.webtoons.com/';

async function downloadImage(url, episodeNumber, episodeTitle, titleMain) {
    episodeTitle = episodeTitle.replace(/[/\\?%*:|"<>]/g, '-');
    const directory = `./images/${titleMain}/${episodeNumber} - ${episodeTitle}`;
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    try {
        let response = await axios.get(url, {
            headers: {
                'Referer': referer
            }
        });

        let imageList = response.data.match(/<div class="viewer_img _img_viewer_area" id="_imageList">(.*?)<\/div>/s);
        if (!imageList) {
            console.error('No images found');
            return;
        }

        imageList = imageList[0].match(/data-url="([^"]+)"/g);
        if (!imageList) {
            console.error('No images found');
            return;
        }

        for (let i = 0; i < imageList.length; i++) {
            let match = imageList[i].match(/data-url="([^"]+)"/);
            if (match && match[1]) {
                let imageUrl = match[1];
                let imageResponse = await axios.get(imageUrl, {
                    responseType: 'stream',
                    headers: {
                        'Referer': referer
                    }
                });
                let imageStream = imageResponse.data.pipe(fs.createWriteStream(`${directory}/${i + 1}.jpg`));
                imageStream.on('finish', () => {
                    console.log(`Downloaded image ${i + 1}`);
                });
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

(async () => {
    await getTitleMain();
    let url_last = await getLastEpisode();
    if (!url_last) return;
    let episodes = await getAllEpisodes(url_last);
    for (let i = 0; i < episodes.length; i++) {
        const episode = episodes[i];
        console.log(`Downloading episode ${episode.episodeNumber} - ${episode.episodeTitle}`);
        await downloadImage(episode.episodeURL, episode.episodeNumber, episode.episodeTitle, title_main);
    }
})();
