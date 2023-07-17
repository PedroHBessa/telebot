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
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Configurações de autenticação do Google Drive
const drive = google.drive({ version: 'v3', auth });

// Objeto para armazenar o estado da conversa
const conversationState = {};

async function uploadImageToDrive(imagePath) {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: path.basename(imagePath),
        parents: ['1Ji5gpATr4c4H1qVYPOfMfJD1ziXxbziQ'], // Replace with the ID of the destination folder in Google Drive
      },
      media: {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(imagePath),
      },
    });

    const { id } = response.data;
    return id;
  } catch (error) {
    console.error('Error uploading image to Google Drive:', error);
    return null;
  }
}

// Função para enviar as respostas para a planilha
async function enviarRespostasParaPlanilha(respostas) {
  const spreadsheetId = '1UOPujHcd8TGBjosBdkG9kTMfegMZ0vBunnJa1fB2Yqc';
  const range = 'Página1!A1'; // Defina o intervalo onde deseja enviar as respostas

  const imageUrl = respostas.pop(); // Get the image URL from the answers
  respostas.push(imageUrl); // Add the image URL as the answer

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

const initBot = async () => {
  //handle images
  bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const photo = msg.photo[msg.photo.length - 1];
  
    try {
      // Save the photo file to a local directory
      const fileId = photo.file_id;
      const ext = '.jpg';
      const filename = `${Date.now()}${ext}`;
      const filePath = path.join(__dirname, 'arquivos', filename);
  
      const fileUrl = await bot.getFileLink(fileId);
      if (fileUrl) {
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
          .then(async () => {
            // Upload the image to Google Drive and get the URL
            const imageUrl = await uploadImageToDrive(filePath);
  
            // Finalize the conversation and include the image URL in the answers
            const response = 'Dados salvos na planilha com sucesso. Conversa finalizada';
            bot.sendMessage(chatId, response);
            const respostas = conversationState[chatId].answers;
            respostas.push(`https://drive.google.com/file/d/${imageUrl}/view?usp=drive_link`);
            console.log(respostas)
            enviarRespostasParaPlanilha(respostas);
            delete conversationState[chatId];
          })
          .catch((error) => {
            console.error('Erro ao salvar a foto do usuário:', error);
            const response = 'Houve um erro ao salvar a foto do usuário. Por favor, tente novamente.';
            bot.sendMessage(chatId, response);
          });
      } else {
        const response = 'Houve um erro ao obter o URL do arquivo. Por favor, tente novamente.';
        bot.sendMessage(chatId, response);
      }
    } catch (error) {
      console.error('Erro ao salvar o arquivo de imagem:', error);
      const response = 'Houve um erro ao salvar o arquivo de imagem. Por favor, tente novamente.';
      bot.sendMessage(chatId, response);
    }
  });
  

  // Tratamento de mensagens recebidas
  bot.onText(/\/sair/, async (msg) => {
    const chatId = msg.chat.id;

    // Restart the bot by deleting the conversation state
    delete conversationState[chatId];

    const response = 'Bot reiniciado.';
    bot.sendMessage(chatId, response);
  });




  bot.onText(/.*/, async (msg) => {
    const chatId = msg.chat.id;
    const message = msg.text;

    if (!conversationState[chatId]) {
      conversationState[chatId] = {
        step: 1,
        answers: []
      };

      const response = 'Olá, você quer lançar uma nota? (Digite "/sair" a qualquer momento para reiniciar o bot)';
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
      }   else if (currentStep === 2) {
        // Armazenar resposta à terceira pergunta
        conversationState[chatId].answers.push(message);

        
        response = `Qual a fase da obra?`;
        const options = {
            reply_markup: {
              keyboard: [['0-Demolição'],['1-Pedreiro - Fundação até a laje'],['2-Pedreiro- Cobertura'],['3-Eletricista (conduítes)'],['4-Pedreiro - Emboço, faixas em esquadrias e pingadeira'],['5-Pedreiro - Muro e pingadeiras'],['6-Pedreiro - aguada e contrapiso'],['7-Pedreiro - rampa garag. e acesso'],['8-Bombeiro Água e esgoto'],['9-Instalações de gás e ar condicionado'],['10-Ladrilheiro'],['11-Carpinteiro esquadrias e porta pivotante'],['12-Vidraceiro (mão de obra)'],['13-Instalador de granito e louças'],['14-Gesseiro (LISO,DRYWALL, PAREDE 3D E DECORA)'],['15-Pintor'],['16-Eletricista'],['17-Pergolado'],['18-Cisterna'],['19-INSS E ISS'],['20-chuva e feriados'],['21-Máquinas, ferramentas e veículos'],['22-Limpeza de obra'],['23-Acompanhamento'],['24-Comissão corretor'],['25-Combustível'],['26-Alojamento + alimentação'],['27-Projetos complementares'],['28-Despesas escritório, taxas e contabilidade,locação de sala']], 
              one_time_keyboard: true // Remover teclado após seleção
            }
          };
          bot.sendMessage(chatId, response, options);
        conversationState[chatId].step++;
        console.log(currentStep, conversationState[chatId] )
      } else if (currentStep === 3) {
        // Armazenar resposta à segunda pergunta
        conversationState[chatId].answers.push(message);

        // Pergunta 3: Qual o valor da nota?
        response = 'Qual o valor da nota?';
        bot.sendMessage(chatId, response);
        conversationState[chatId].step++;
      } else if(currentStep === 4) {
        // Verificar se a resposta é um número de ponto flutuante
        const value = parseFloat(message.replace(',', '.'));

        if (isNaN(value)) {
          console.log("qweqwe4");
          // Valor inválido
          response = 'Valor inválido. Por favor, insira um número válido.';
          bot.sendMessage(chatId, response);
        } else {
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
          
        
       
       
      } else if (currentStep === 5) {
        
        if (message.toLowerCase() === 'sim') {
          // Pergunta 5: Envie o arquivo de imagem
          response = 'Por favor, envie o arquivo de imagem:';
          bot.sendMessage(chatId, response);
          conversationState[chatId].step++;
          return;
        } else {
          // Finalizar a conversa se a resposta for "Não"
          response = 'Conversa finalizada. Obrigado por utilizar o bot!';
          bot.sendMessage(chatId, response);
          const respostas = conversationState[chatId].answers;
          enviarRespostasParaPlanilha(respostas);
          delete conversationState[chatId];
          return;
        }
      } else {
        return;
      }
    }
  });
}



initBot();
