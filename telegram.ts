import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import { session } from "telegraf";
import { chat } from "./agent";

const token = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_USER_ID = process.env.AUTHORIZED_USER_ID;

type UserState = 'idle' | 'waiting_for_link' | 'waiting_for_choice' | 'waiting_for_percentage' | 'completed';

interface MySession {
    isActive: boolean;
    state: UserState;
    answers: {
        eventLink?: string;
        choice?: 'YES' | 'NO';
        price?: number;
    };
}

// 扩展上下文类型
interface MyContext extends Context {
    session: MySession;
}

const bot = new Telegraf<MyContext>(token!);

// 使用会话中间件，设置默认值
bot.use(session({
    defaultSession: () => ({ 
        isActive: false, 
        state: 'idle' as UserState,
        answers: {}
    })
}));

bot.use((ctx, next) => {
    // ctx.from.id 是发送消息用户的 ID
    // 我们把它转成字符串来和环境变量进行比较，确保类型一致
    const senderId = String(ctx.from?.id);
  
    if (senderId === AUTHORIZED_USER_ID) {
      return next();
    } else {
      console.log(`Unauthorized access denied for user ID: ${senderId}`);
      return ctx.reply('抱歉，你无权使用此机器人。');
    }
  });

bot.start((ctx) => {
    ctx.session.isActive = true;
    ctx.session.state = 'waiting_for_link';
    ctx.session.answers = {};
    
    ctx.reply('Welcome to the Polymarket Agent! 🚀\n\n请按顺序回答以下问题：\n\n1️⃣ 请输入你购买Polymarket的事件链接：');
});

bot.hears('foo', (ctx) => ctx.reply('bar'));
// 监听文本消息
bot.on(message('text'), async (ctx) => {
    // 检查用户是否已启动
    if (!ctx.session?.isActive) {
        ctx.reply('请先使用 /start 命令启动机器人');
        return;
    }
    
    const currentState = ctx.session.state;
    
    switch (currentState) {
        case 'waiting_for_link':
            // 保存事件链接
            ctx.session.answers.eventLink = ctx.message.text;
            ctx.session.state = 'waiting_for_choice';
            ctx.reply(`✅ 事件链接已保存：${ctx.message.text}\n\n2️⃣ 你买的是YES还是NO？`);
            break;
            
        case 'waiting_for_choice':
            const choice = ctx.message.text.toUpperCase();
            if (choice === 'YES' || choice === 'NO') {
                ctx.session.answers.choice = choice as 'YES' | 'NO';
                ctx.session.state = 'waiting_for_percentage';
                ctx.reply(`✅ 选择已保存：${choice}\n\n3️⃣ 在多少百分比的时候买的？（请输入数字，如：75）`);
            } else {
                ctx.reply('❌ 请只输入 YES 或 NO');
            }
            break;
            
        case 'waiting_for_percentage':
            const price = parseFloat(ctx.message.text);
            if (!isNaN(price) && price >= 0 && price <= 100) {
                ctx.session.answers.price = price;
                ctx.session.state = 'completed';
                
                // 显示所有答案
                const {eventLink,choice} = ctx.session.answers;

                const searchQuery = `
                I bought a polymarket event at ${price}¢ for ${choice} on ${eventLink}
                `
                
                try {
                    const result = await chat(searchQuery,(message)=> ctx.reply(message));
                    
                    const { content, citations } = result;
                    
                    if (content && content.trim()) {
                        ctx.reply(content);
                    } else {
                        ctx.reply("No result found, please try again");
                    }
                    
                    if (citations && citations.length > 0) {
                        const buttons = citations.map((url, index) => [{
                            text: `🔗 来源 ${index + 1}`,
                            url: url
                        }]);
                        
                        ctx.reply('📖 点击查看详细来源:', {
                            reply_markup: {
                                inline_keyboard: buttons
                            }
                        });
                    }
                } catch (error) {
                    console.error('搜索出错:', error);
                    ctx.reply('抱歉，搜索时出现了错误，请稍后重试。');
                }
                break;
            } else {
                ctx.reply('❌ 请输入0-100之间的有效数字');
            }
            break;
                
        default:
            ctx.reply('请使用 /start 重新开始');
            break;
    }
});

if(process.env.ENV === 'production'){
    console.log('Bot started in production mode');
    bot.launch({
        webhook: {
            domain: process.env.WEBHOOK_DOMAIN!,
            port: Number(process.env.WEBHOOK_PORT!),
        }
    })
}else{
    console.log('Bot started in development mode');
    bot.launch()
}