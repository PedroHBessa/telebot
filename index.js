const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Configurações do bot do Telegram
const token = '6301739956:AAEudGIc4wjQx6jkuTL2DaClcghNaECqw84';
const bot = new TelegramBot(token, { polling: true });
let answers = [];
const ext = '.jpg';
const filename = `${Date.now()}${ext}`;
      const filePath = path.join(__dirname, 'arquivos', filename);

// Configurações de autenticação do Google Sheets
const auth = new google.auth.GoogleAuth({
  keyFile: 'bot02.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Configurações de autenticação do Google Drive
const drive = google.drive({ version: 'v3', auth });

// Objeto para armazenar o estado da conversa
let conversationState = {};

async function uploadImageToDrive(imagePath, folder) {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: path.basename(imagePath),
        parents: [folder], // Replace with the ID of the destination folder in Google Drive
      },
      media: {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(imagePath),
      },
    });
    // Delete local file after upload
    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error(`Error deleting the image: ${err}`);
      } else {
        console.log('Image deleted successfully.');
      }
    });

    const { id } = response.data;
    return id;
  } catch (error) {
    console.error('Error uploading image to Google Drive:', error);
    return null;
  }
}

// Função para enviar as respostas para a planilha
async function enviarRespostasParaPlanilha(respostas, planilha, chatId) {
  
  const spreadsheetId = planilha; // ALTERAR COM ID DA PLANILHA
  const range = 'Página1!A1'; // Defina o intervalo onde deseja enviar as respostas

  const imageUrl = respostas.pop(); // Get the image URL from the answers
  respostas.push(imageUrl); 
  
  let respostasOrd = [respostas[0], respostas[2], respostas[1]]



  try {
    sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [respostasOrd],
      },
    });
    conversationState[chatId] = {
      currentStep: 1,
      folder: '',
      planilha: ''
    };
    answers = [];
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
           


            const chatIdPhoto = msg.chat.id;
    let response = 'Olá, você quer lançar uma nota? (Digite "/sair" a qualquer momento para reiniciar o bot)';
    const options = {
      reply_markup: {
        keyboard: [['Sim', 'Não']],
        one_time_keyboard: true // Remover teclado após seleção
      }
    };
    bot.sendMessage(chatIdPhoto, response, options);

   


    


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
   



  })}

  bot.onText(/.*/, async (msg) => {
    const chatId = msg.chat.id;
    const message = msg.text;
    if(msg.text === "/sair") {
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error(`Error deleting the image: ${err}`);
        } else {
          console.log('Image deleted successfully.');
        }
      });
      delete conversationState[chatId];
      answers = [];
      bot.sendMessage(chatId, "Bot reiniciado com sucesso!");

      return;
    }
    if (!conversationState[chatId]) {
      // If conversation state doesn't exist, initialize it
      conversationState[chatId] = {
        currentStep: 1,
        folder: '', // Initialize folder property as empty
        planilha: ''
      };
    }
  
    

      if (conversationState[chatId].currentStep === 1) {
        if (message.toLowerCase() === 'não') {
          // Finalizar a conversa se a resposta for "Não"
          response = 'Conversa finalizada. Obrigado por utilizar o bot!';
          bot.sendMessage(chatId, response);
          delete conversationState[chatId];
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
          
          conversationState[chatId].currentStep++
          
        }
      } else if (conversationState[chatId].currentStep === 2) {

        
        response = `Qual a fase da obra?`;
        const options = {
            reply_markup: {
              keyboard: [['0-Demolição'],['1-Pedreiro - Fundação até a laje'],['2-Pedreiro- Cobertura'],['3-Eletricista (conduítes)'],['4-Pedreiro - Emboço, faixas em esquadrias e pingadeira'],['5-Pedreiro - Muro e pingadeiras'],['6-Pedreiro - aguada e contrapiso'],['7-Pedreiro - rampa garag. e acesso'],['8-Bombeiro Água e esgoto'],['9-Instalações de gás e ar condicionado'],['10-Ladrilheiro'],['11-Carpinteiro esquadrias e porta pivotante'],['12-Vidraceiro (mão de obra)'],['13-Instalador de granito e louças'],['14-Gesseiro (LISO,DRYWALL, PAREDE 3D E DECORA)'],['15-Pintor'],['16-Eletricista'],['17-Pergolado'],['18-Cisterna'],['19-INSS E ISS'],['20-chuva e feriados'],['21-Máquinas, ferramentas e veículos'],['22-Limpeza de obra'],['23-Acompanhamento'],['24-Comissão corretor'],['25-Combustível'],['26-Alojamento + alimentação'],['27-Projetos complementares'],['28-Despesas escritório, taxas e contabilidade,locação de sala']], 
              one_time_keyboard: true // Remover teclado após seleção
            }
          };
          bot.sendMessage(chatId, response, options);
          answers.push(message);
          conversationState[chatId].currentStep++
          if(message.toLowerCase() === "compra") {
            conversationState[chatId].planilha = "1WzkkmAkBoLA44BhobtcCAfJiUHWqBoDntb0wM577Pa4" // PREENCHER COM ID DA PLANILHA DE COMPRAS
            conversationState[chatId].folder = "1cQTlWdd1b18szJ1VDePnHICRQxbIBt5F"
          } else {
            conversationState[chatId].planilha = "1k7diSjCYeuSH4W2jISuaw4lBKMNgLfcYQkl_xU9AYXI" // PREENCHER COM ID DA PLANILHA DE SERVIÇOS
            conversationState[chatId].folder = "19rCKI1_gTI4Jm2nvPADaKUHH7Up5o7SK"
          }
          const imageUrl = await uploadImageToDrive(filePath, conversationState[chatId].folder);
          answers.push(`https://drive.google.com/file/d/${imageUrl}/view?usp=drive_link`);
      
      } else if (conversationState[chatId].currentStep === 3) {

        // Pergunta 3: Qual o valor da nota?
        response = 'Qual o valor da nota?';
        bot.sendMessage(chatId, response);
        
        conversationState[chatId].currentStep++
      } else if(conversationState[chatId].currentStep === 4) {
        // Verificar se a resposta é um número de ponto flutuante
        const value = parseFloat(message.replace(',', '.'));

        if (isNaN(value)) {
          // Valor inválido
          response = 'Valor inválido. Por favor, insira um número válido.';
          bot.sendMessage(chatId, response);
        } else {
          answers.push(value);
          
          enviarRespostasParaPlanilha(answers, conversationState[chatId].planilha, chatId);
          bot.sendMessage(chatId, "Dados salvos na planilha com sucesso!");
          delete conversationState[chatId];
        }
          
        
       
       
     
      
      } else {
        return;
      }
    
  });
initBot();

