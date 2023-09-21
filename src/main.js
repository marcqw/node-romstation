const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.romstation.fr/games/ps2/007-bons-baisers-de-russie-r';
const gamesDirectory = path.join(__dirname, 'games');
const BASE_DESTINATION_FOLDER = 'CLEAN_GAMES/';

async function fetchGameConsole(GAME_ID) {
    const url = `${BASE_URL}${GAME_ID}`;
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const targetElement = $('#elCmsPageWrap > div.ipsPageHeader.ipsBox.ipsResponsive_pull.ipsPadding.ipsClearfix > div.ipsPageHeader__meta.ipsFlex.ipsFlex-jc\\:between.ipsFlex-ai\\:center.ipsFlex-fw\\:wrap.ipsGap\\:3 > div.ipsFlex-flex\\:11 > span > a:nth-child(2) > img');
        return targetElement.attr('alt');
    } catch (error) {
        console.error(`Erreur lors de la récupération des informations pour GAME_ID ${GAME_ID}:`, error);
        throw error;
    }
}

async function fetchGameName(GAME_ID) {
    const url = `${BASE_URL}${GAME_ID}`;
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const targetElement = $('#elCmsPageWrap > div.ipsPageHeader.ipsBox.ipsResponsive_pull.ipsPadding.ipsClearfix > div.ipsFlex.ipsFlex-ai\\:center.ipsFlex-fw\\:wrap.ipsGap\\:4 > div.ipsFlex-flex\\:11 > h1 > span');
        return targetElement.text();
    } catch (error) {
        console.error(`Erreur lors de la récupération des informations pour GAME_ID ${GAME_ID}:`, error);
        throw error;
    }
}

function cleanFileName(fileName) {
    return fileName.replace(/[\/\\?%*:|"<>']/g, '-');
}

async function renameFile(filePath, GAME_NAME) {
    try {
        const extension = path.extname(filePath);
        const dir = path.dirname(filePath);
        const newFileName = `${GAME_NAME}${extension}`;
        const newFilePath = path.join(dir, newFileName);
        await fs.rename(filePath, newFilePath);
        console.log(`Le fichier ${filePath} a été renommé en ${newFileName}`);
        return newFilePath;
    } catch (error) {
        console.error(`Erreur lors du renommage du fichier ${filePath}:`, error);
        throw error;
    }
}

async function moveFileToConsoleFolder(filePath, CONSOLE) {
    try {
        const fileName = path.basename(filePath);
        const consoleFolderPath = path.join(BASE_DESTINATION_FOLDER, CONSOLE);
        await fs.mkdir(consoleFolderPath, { recursive: true });
        const newFilePath = path.join(consoleFolderPath, fileName);
        await fs.rename(filePath, newFilePath);
        console.log(`Le fichier ${filePath} a été déplacé dans le dossier ${consoleFolderPath}`);
    } catch (error) {
        console.error(`Erreur lors du déplacement du fichier ${filePath} dans le dossier ${CONSOLE}:`, error);
        throw error;
    }
}

async function deleteParentDirectories(filePath, levels) {
    try {
        let currentDirectory = path.dirname(filePath);
        for (let i = 0; i < levels; i++) {
            const parentDirectory = path.dirname(currentDirectory);
            await fs.rmdir(currentDirectory, { recursive: true });
            console.log(`Le dossier ${currentDirectory} a été supprimé avec succès.`);
            currentDirectory = parentDirectory;
        }
    } catch (error) {
        console.error(`Erreur lors de la suppression des dossiers parents de ${filePath}:`, error);
        throw error;
    }
}

async function listFilesInDirectory(dir) {
    let results = [];
    const list = await fs.readdir(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        if (stat && stat.isDirectory()) {
            const res = await listFilesInDirectory(filePath);
            results = results.concat(res);
        } else {
            results.push(filePath);
        }
    }
    return results;
}

async function main() {
    try {
        console.log('Début du programme');
        const allFiles = await listFilesInDirectory(gamesDirectory);
        const zipFiles = allFiles.filter(file => path.extname(file) === '.zip');
        console.log('Fichiers .zip trouvés:', zipFiles);

        const errorFiles = [];

        for (const filePath of zipFiles) {
            try {
                const GAME_ID = path.basename(filePath, '.zip');
                console.log(`Traitement du fichier ${filePath} avec GAME_ID ${GAME_ID}`);
                const gameConsole = await fetchGameConsole(GAME_ID);
                const gameName = await fetchGameName(GAME_ID);
                const cleanedGameName = cleanFileName(gameName);
                const newFilePath = await renameFile(filePath, cleanedGameName);
                await moveFileToConsoleFolder(newFilePath, gameConsole);
                await deleteParentDirectories(filePath, 3);
            } catch (error) {
                console.error(`Erreur lors du traitement du fichier ${filePath}:`, error);
                errorFiles.push(filePath);
            }
        }

        if (errorFiles.length > 0) {
            console.error('Les fichiers suivants ont posé problème lors du traitement:', errorFiles);
        } else {
            console.log('Tous les fichiers ont été traités avec succès.');
        }
    } catch (error) {
        console.error('Erreur lors du traitement des fichiers:', error);
    }
}

main();
