const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');


// Configurações do bot do Telegram
const token = '6301739956:AAEudGIc4wjQx6jkuTL2DaClcghNaECqw84';
const bot = new TelegramBot(token, { polling: true });

// Configurações de autenticação do Google Sheets
const auth = new google.auth.GoogleAuth({
  keyFile: 'bot02.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Objeto para armazenar o estado da conversa
const conversationState = {};

// Função para enviar as respostas para a planilha
async function enviarRespostasParaPlanilha(respostas) {
  const spreadsheetId = '1BX97uc_ffABZhgiOGT82coYI9PmyoMlGFK2gaMxTdCE';
  const range = 'Página1!A1'; // Defina o intervalo onde deseja enviar as respostas

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [respostas],
      },
    });


  } catch (error) {
    console.error('Erro ao enviar respostas para a planilha:', error);
  }
}


// Tratamento de mensagens recebidas
bot.onText(/.*/, async (msg) => {
  const chatId = msg.chat.id;
  const message = msg.text;

  if (!conversationState[chatId]) {
    conversationState[chatId] = {
      step: 1,
      answers: []
    };

    const response = 'Olá, você quer lançar uma nota?';
    const options = {
      reply_markup: {
        keyboard: [['Sim', 'Não']],
        one_time_keyboard: true // Remover teclado após seleção
      }
    };
    bot.sendMessage(chatId, response, options);
  } else {
    const currentStep = conversationState[chatId].step;
    let response;

    if (currentStep === 1) {
      // Armazenar resposta à primeira pergunta
      conversationState[chatId].answers.push(message);

      if (message.toLowerCase() === 'não') {
        // Finalizar a conversa se a resposta for "Não"
        response = 'Conversa finalizada. Obrigado por utilizar o bot!';
        bot.sendMessage(chatId, response);
        delete conversationState[chatId];
        return;
      } else {
        // Pergunta 2: Qual o tipo da nota?
        response = 'Qual o tipo da nota?';
        const options = {
          reply_markup: {
            keyboard: [['Compra', 'Serviço']],
            one_time_keyboard: true // Remover teclado após seleção
          }
        };
        bot.sendMessage(chatId, response, options);
        conversationState[chatId].step++;
      }
    } else if (currentStep === 2) {
      // Armazenar resposta à segunda pergunta
      conversationState[chatId].answers.push(message);

      // Pergunta 3: Qual o valor da nota?
      response = 'Qual o valor da nota?';
      bot.sendMessage(chatId, response);
      conversationState[chatId].step++;
    } else if (currentStep === 3) {
      // Verificar se a resposta é um número de ponto flutuante
      const value = parseFloat(message.replace(',', '.'));

      if (isNaN(value)) {
        // Valor inválido
        response = 'Valor inválido. Por favor, insira um número válido.';
        bot.sendMessage(chatId, response);
      } else {
        // Valor válido
        conversationState[chatId].answers.push(value);

        // Pergunta 4: Deseja enviar um anexo?
        response = 'Deseja enviar um anexo?';
        const options = {
          reply_markup: {
            keyboard: [['Sim', 'Não']],
            one_time_keyboard: true // Remover teclado após seleção
          }
        };
        bot.sendMessage(chatId, response, options);
        conversationState[chatId].step++;
      }
    } else if (currentStep === 4) {
      // Armazenar resposta à pergunta sobre o envio de anexo
      conversationState[chatId].answers.push(message);

      if (message.toLowerCase() === 'sim') {
        // Pergunta 5: Envie o arquivo de imagem
        response = 'Por favor, envie o arquivo de imagem:';
        bot.sendMessage(chatId, response);
        conversationState[chatId].step++;
      } else {
        // Finalizar a conversa se a resposta for "Não"
        response = 'Conversa finalizada. Obrigado por utilizar o bot!';
        bot.sendMessage(chatId, response);
        const respostas = conversationState[chatId].answers;
        enviarRespostasParaPlanilha(respostas);
        delete conversationState[chatId];
        return;
      }
    } else if (currentStep === 5) {
      // Salvar a foto do usuário na pasta "arquivos"
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const ext = '.jpg';
      const filename = `${Date.now()}${ext}`;
      const filePath = path.join(__dirname, 'arquivos', filename);
      const fileUrl = await getFileUrl(fileId);

      if (fileUrl) {
        try {
          const response = await axios({
            url: fileUrl,
            responseType: 'stream',
          });
          const writeStream = fs.createWriteStream(filePath);
          response.data.pipe(writeStream);

          return new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          })
            .then(() => {
              // Finalizar a conversa
              response = 'Conversa finalizada. Obrigado por utilizar o bot!';
              bot.sendMessage(chatId, response);
              const respostas = conversationState[chatId].answers;
              enviarRespostasParaPlanilha(respostas);
              delete conversationState[chatId];
            })
            .catch((error) => {
              console.error('Erro ao salvar a foto do usuário:', error);
              response = 'Houve um erro ao salvar a foto do usuário. Por favor, tente novamente.';
              bot.sendMessage(chatId, response);
            });
        } catch (error) {
          console.error('Erro ao obter o URL do arquivo:', error);
          response = 'Houve um erro ao obter o URL do arquivo. Por favor, tente novamente.';
          bot.sendMessage(chatId, response);
        }
      } else {
        response = 'Houve um erro ao obter o URL do arquivo. Por favor, tente novamente.';
        bot.sendMessage(chatId, response);
      }
    }
  }
});



