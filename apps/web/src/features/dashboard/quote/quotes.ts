/**
 * The dashboard's quote library: lines that push you to start, keep going or
 * finish, half from Chinese writers and classics, half from elsewhere. Every
 * entry carries both languages, so switching language shows the same line.
 *
 * Only lines with a known source are kept. Popular misattributions ("Einstein
 * said…", "an old Chinese proverb…") stay out, and so do modern rewrites
 * credited to a classic (荀子 wrote 道虽迩，不行不至, not 路虽远，行则将至).
 */

export type QuoteEntry = {
  zh: string
  en: string
  /** Who said it: in zh with the work where it helps, in en the name. */
  by: { zh: string; en: string }
  /** Which side the line was first written in; the other is a translation. */
  origin: 'zh' | 'intl'
}

const zh = (text: string, byZh: string, en: string, byEn: string): QuoteEntry => ({
  zh: text,
  en,
  by: { zh: byZh, en: byEn },
  origin: 'zh',
})

const intl = (text: string, byEn: string, zhText: string, byZh: string): QuoteEntry => ({
  zh: zhText,
  en: text,
  by: { zh: byZh, en: byEn },
  origin: 'intl',
})

export const QUOTES: QuoteEntry[] = [
  // ── Classics ──
  zh('千里之行，始于足下。', '《道德经》', 'A journey of a thousand miles begins beneath your feet.', 'Laozi'),
  zh('合抱之木，生于毫末；九层之台，起于累土。', '《道德经》', 'A tree too wide to embrace grows from a tiny shoot; a nine-storey tower rises from a heap of earth.', 'Laozi'),
  zh('天下难事，必作于易；天下大事，必作于细。', '《道德经》', 'The hardest things in the world begin as easy ones; the greatest begin as small ones.', 'Laozi'),
  zh('胜人者有力，自胜者强。', '《道德经》', 'To overcome others takes force; to overcome yourself takes strength.', 'Laozi'),
  zh('天行健，君子以自强不息。', '《周易》', 'Heaven moves on without rest; so the noble person strives without end.', 'I Ching'),
  zh('君子藏器于身，待时而动。', '《周易·系辞下》', 'Keep your tools ready, and wait for the moment to act.', 'I Ching'),
  zh('不积跬步，无以至千里；不积小流，无以成江海。', '《荀子·劝学》', 'Without single steps you never travel a thousand miles; without small streams there are no rivers and seas.', 'Xunzi'),
  zh('骐骥一跃，不能十步；驽马十驾，功在不舍。', '《荀子·劝学》', 'A fine horse can’t cover ten paces in one leap; a slow one goes far in ten days because it never stops.', 'Xunzi'),
  zh('锲而舍之，朽木不折；锲而不舍，金石可镂。', '《荀子·劝学》', 'Give up carving and even rotten wood won’t break; keep carving and metal and stone will yield.', 'Xunzi'),
  zh('道虽迩，不行不至；事虽小，不为不成。', '《荀子·修身》', 'However near the road, you won’t arrive unless you walk it; however small the task, it won’t be done unless you do it.', 'Xunzi'),
  zh('士不可以不弘毅，任重而道远。', '《论语·泰伯》', 'Be broad of mind and firm of will, for the load is heavy and the road is long.', 'The Analects'),
  zh('知之者不如好之者，好之者不如乐之者。', '《论语·雍也》', 'Knowing it is not as good as loving it; loving it is not as good as delighting in it.', 'The Analects'),
  zh('学而不思则罔，思而不学则殆。', '《论语·为政》', 'Learning without thinking is lost; thinking without learning is perilous.', 'The Analects'),
  zh('苟日新，日日新，又日新。', '《礼记·大学》', 'If you can renew yourself for one day, do it every day, and again the next.', 'The Great Learning'),
  zh('凡事豫则立，不豫则废。', '《礼记·中庸》', 'What is prepared for stands; what is not, falls.', 'Doctrine of the Mean'),
  zh('人一能之，己百之；人十能之，己千之。', '《礼记·中庸》', 'If others manage it in one try, I’ll take a hundred; if in ten, I’ll take a thousand.', 'Doctrine of the Mean'),
  zh('行百里者半于九十。', '《战国策》', 'On a journey of a hundred miles, ninety is only halfway.', 'Strategies of the Warring States'),
  zh('靡不有初，鲜克有终。', '《诗经·大雅》', 'Everything has a beginning; few things see an end.', 'Book of Songs'),
  zh('生于忧患，死于安乐。', '《孟子·告子下》', 'We live on through hardship and perish in ease.', 'Mencius'),
  zh('志不强者智不达。', '《墨子·修身》', 'Where the will is weak, wisdom won’t go far.', 'Mozi'),
  zh('有志者事竟成。', '《后汉书》', 'Where there is a will, the thing gets done.', 'Book of the Later Han'),
  zh('临渊羡鱼，不如退而结网。', '《汉书·董仲舒传》', 'Rather than stand by the pool wishing for fish, go home and weave a net.', 'Book of Han'),
  zh('绳锯木断，水滴石穿。', '罗大经《鹤林玉露》', 'A rope saws through wood; dripping water wears through stone.', 'Luo Dajing'),
  zh('世上无难事，只怕有心人。', '吴承恩《西游记》', 'Nothing in the world is hard for someone who truly sets their mind to it.', 'Wu Cheng’en, Journey to the West'),
  zh('宝剑锋从磨砺出，梅花香自苦寒来。', '《警世贤文》', 'A sword’s edge comes from the grindstone; the plum’s scent comes from bitter cold.', 'Chinese maxim'),

  // ── Poets and writers ──
  zh('路漫漫其修远兮，吾将上下而求索。', '屈原《离骚》', 'The road ahead is long and far; I will search high and low.', 'Qu Yuan'),
  zh('老骥伏枥，志在千里；烈士暮年，壮心不已。', '曹操《龟虽寿》', 'The old horse in the stable still dreams of a thousand miles; a hero in late years keeps a young heart.', 'Cao Cao'),
  zh('丈夫志四海，万里犹比邻。', '曹植《赠白马王彪》', 'With your heart set on the four seas, ten thousand miles are next door.', 'Cao Zhi'),
  zh('非淡泊无以明志，非宁静无以致远。', '诸葛亮《诫子书》', 'Without simplicity you can’t make your purpose clear; without calm you can’t reach far.', 'Zhuge Liang'),
  zh('盛年不重来，一日难再晨。及时当勉励，岁月不待人。', '陶渊明《杂诗》', 'Your prime won’t come twice; a day has one morning. Make the most of it — the years wait for no one.', 'Tao Yuanming'),
  zh('少壮不努力，老大徒伤悲。', '汉乐府《长歌行》', 'Idle when young, you’ll grieve in vain when old.', 'Han folk song'),
  zh('穷且益坚，不坠青云之志。', '王勃《滕王阁序》', 'In hard times grow firmer, and never let your high aims fall.', 'Wang Bo'),
  zh('长风破浪会有时，直挂云帆济沧海。', '李白《行路难》', 'A day will come to ride the wind and break the waves; I’ll raise my sail and cross the sea.', 'Li Bai'),
  zh('大鹏一日同风起，扶摇直上九万里。', '李白《上李邕》', 'One day the great bird will rise with the wind and soar ninety thousand miles.', 'Li Bai'),
  zh('天生我材必有用。', '李白《将进酒》', 'Heaven made my talents, and they are meant to be used.', 'Li Bai'),
  zh('会当凌绝顶，一览众山小。', '杜甫《望岳》', 'One day I’ll stand on the summit and see every other mountain small below.', 'Du Fu'),
  zh('欲穷千里目，更上一层楼。', '王之涣《登鹳雀楼》', 'To see a thousand miles further, climb one more floor.', 'Wang Zhihuan'),
  zh('莫愁前路无知己，天下谁人不识君。', '高适《别董大》', 'Don’t worry that no friend waits on the road ahead — who in the world won’t know you?', 'Gao Shi'),
  zh('业精于勤，荒于嬉；行成于思，毁于随。', '韩愈《进学解》', 'Skill grows through diligence and withers in play; deeds succeed through thought and fail through drift.', 'Han Yu'),
  zh('沉舟侧畔千帆过，病树前头万木春。', '刘禹锡', 'Past the sunken boat a thousand sails go by; beyond the withered tree ten thousand trees turn green.', 'Liu Yuxi'),
  zh('千淘万漉虽辛苦，吹尽狂沙始到金。', '刘禹锡《浪淘沙》', 'Sifting a thousand times is hard, but blow away the sand and you reach the gold.', 'Liu Yuxi'),
  zh('黑发不知勤学早，白首方悔读书迟。', '颜真卿《劝学》', 'Young, we don’t know to study early; grey, we regret starting late.', 'Yan Zhenqing'),
  zh('博观而约取，厚积而薄发。', '苏轼《稼说送张琥》', 'Read widely and take sparingly; store up much and let out a little.', 'Su Shi'),
  zh('古之立大事者，不惟有超世之才，亦必有坚忍不拔之志。', '苏轼《晁错论》', 'Those who did great things had not only rare talent but an unshakable will.', 'Su Shi'),
  zh('竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。', '苏轼《定风波》', 'Bamboo staff and straw sandals beat a horse — who’s afraid? In a straw cape I’ll take whatever rain life brings.', 'Su Shi'),
  zh('不畏浮云遮望眼，自缘身在最高层。', '王安石《登飞来峰》', 'I don’t fear clouds blocking my view, for I stand on the highest level.', 'Wang Anshi'),
  zh('问渠那得清如许？为有源头活水来。', '朱熹《观书有感》', 'How is the pond so clear? Because fresh water keeps flowing in from the source.', 'Zhu Xi'),
  zh('山重水复疑无路，柳暗花明又一村。', '陆游《游山西村》', 'Hills and streams wind on and you think there’s no way through — then, past willows and flowers, another village.', 'Lu You'),
  zh('纸上得来终觉浅，绝知此事要躬行。', '陆游《冬夜读书示子聿》', 'What you learn from paper stays shallow; to really know a thing, you have to do it.', 'Lu You'),
  zh('莫等闲，白了少年头，空悲切。', '岳飞《满江红》', 'Don’t idle away your youth, only to grieve in vain when your hair turns white.', 'Yue Fei'),
  zh('乘风好去，长空万里，直下看山河。', '辛弃疾《太常引》', 'Ride the wind and go — ten thousand miles of sky, looking straight down on the land.', 'Xin Qiji'),
  zh('明日复明日，明日何其多。我生待明日，万事成蹉跎。', '钱福《明日歌》', 'Tomorrow and tomorrow — so many tomorrows! Wait for tomorrow all your life and everything slips away.', 'Qian Fu'),
  zh('一年之计在于春，一日之计在于晨。', '萧绎《纂要》', 'The year is planned in spring; the day is planned in the morning.', 'Xiao Yi'),
  zh('志不立，天下无可成之事。', '王阳明《教条示龙场诸生》', 'Without a set purpose, nothing in the world gets done.', 'Wang Yangming'),
  zh('知是行之始，行是知之成。', '王阳明《传习录》', 'Knowing is the start of doing; doing is the completion of knowing.', 'Wang Yangming'),
  zh('咬定青山不放松，立根原在破岩中。千磨万击还坚劲，任尔东西南北风。', '郑燮《竹石》', 'Gripping the mountain, rooted in cracked rock; ground and struck a thousand times, still firm, whatever winds may blow.', 'Zheng Xie'),

  // ── Modern ──
  zh('其实地上本没有路，走的人多了，也便成了路。', '鲁迅《故乡》', 'There was no road at first; when many people walk the same way, a road is made.', 'Lu Xun'),
  zh('有一分热，发一分光，就令萤火一般，也可以在黑暗里发一点光。', '鲁迅《热风》', 'Give as much light as you have heat. Even a firefly can shine a little in the dark.', 'Lu Xun'),
  zh('怕什么真理无穷，进一寸有一寸的欢喜。', '胡适', 'Why fear that truth is endless? Every inch forward brings an inch of joy.', 'Hu Shih'),
  zh('功不唐捐，没有一点努力是会白白地丢了的。', '胡适', 'No effort is wasted. Not one bit of it is ever simply lost.', 'Hu Shih'),
  zh('凡做一件事，便忠于一件事，将全副精力集中到这事上头。', '梁启超《敬业与乐业》', 'Whatever you do, be faithful to it, and bring your whole strength to bear on it.', 'Liang Qichao'),
  zh('生活不能等待别人来安排，要自己去争取和奋斗。', '路遥《平凡的世界》', 'Don’t wait for others to arrange your life. Fight for it yourself.', 'Lu Yao, Ordinary World'),
  zh('既然选择了远方，便只顾风雨兼程。', '汪国真《热爱生命》', 'Having chosen the far horizon, I’ll only keep going through wind and rain.', 'Wang Guozhen'),
  zh('黑夜给了我黑色的眼睛，我却用它寻找光明。', '顾城《一代人》', 'The dark night gave me dark eyes, yet I use them to look for light.', 'Gu Cheng'),

  // ── Elsewhere: work and craft ──
  intl('Stay hungry. Stay foolish.', 'Steve Jobs', '求知若饥，虚心若愚。', '史蒂夫·乔布斯'),
  intl('The only way to do great work is to love what you do.', 'Steve Jobs', '成就伟大工作的唯一方法，就是热爱你所做的事。', '史蒂夫·乔布斯'),
  intl('Focusing is about saying no.', 'Steve Jobs', '专注，就是学会说不。', '史蒂夫·乔布斯'),
  intl('Real artists ship.', 'Steve Jobs', '真正的艺术家会把作品交出去。', '史蒂夫·乔布斯'),
  intl('The best way to predict the future is to invent it.', 'Alan Kay', '预测未来最好的办法，就是把它创造出来。', '艾伦·凯'),
  intl('Inspiration is for amateurs. The rest of us just show up and get to work.', 'Chuck Close', '等灵感是业余的做法，其他人只管到场、开工。', '查克·克洛斯'),
  intl('Great things are not done by impulse, but by a series of small things brought together.', 'Vincent van Gogh', '伟大的事不是靠一时冲动做成的，而是由一连串小事汇聚而成。', '梵高'),
  intl('What would life be if we had no courage to attempt anything?', 'Vincent van Gogh', '如果我们没有勇气去尝试任何事，生活会是什么样子？', '梵高'),
  intl('Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.', 'Antoine de Saint-Exupéry', '完美不在于无可增添，而在于无可删减。', '圣埃克苏佩里《人的大地》'),
  intl('What I cannot create, I do not understand.', 'Richard Feynman', '我造不出来的东西，我就没有真正理解。', '理查德·费曼'),
  intl('If I have seen further, it is by standing on the shoulders of giants.', 'Isaac Newton', '如果说我看得更远，那是因为我站在巨人的肩膀上。', '艾萨克·牛顿'),
  intl('Chance favors only the prepared mind.', 'Louis Pasteur', '机会只青睐有准备的头脑。', '路易·巴斯德'),
  intl('Genius is one percent inspiration and ninety-nine percent perspiration.', 'Thomas Edison', '天才是百分之一的灵感，加上百分之九十九的汗水。', '托马斯·爱迪生'),
  intl('Life is like riding a bicycle. To keep your balance, you must keep moving.', 'Albert Einstein', '人生就像骑自行车，想保持平衡，就得不停向前。', '阿尔伯特·爱因斯坦'),
  intl('Remember to look up at the stars and not down at your feet.', 'Stephen Hawking', '记得抬头仰望星空，而不是低头看脚下。', '史蒂芬·霍金'),
  intl('If there’s a book that you want to read, but it hasn’t been written yet, then you must write it.', 'Toni Morrison', '如果有一本你想读的书还没人写，那你就得自己去写。', '托妮·莫里森'),

  // ── Elsewhere: habits and time ──
  intl('We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant', '我们反复做的事造就了我们。卓越不是一时之举，而是一种习惯。', '威尔·杜兰特'),
  intl('You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear', '你不会升到目标的高度，只会落到系统的水平。', '詹姆斯·克利尔《掌控习惯》'),
  intl('Every action you take is a vote for the type of person you wish to become.', 'James Clear', '你的每一个行动，都是在为你想成为的那种人投票。', '詹姆斯·克利尔《掌控习惯》'),
  intl('What you do every day matters more than what you do once in a while.', 'Gretchen Rubin', '你每天做的事，比你偶尔做的事更重要。', '格雷琴·鲁宾'),
  intl('It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca', '不是我们的生命太短，而是我们浪费了太多。', '塞涅卡《论生命之短暂》'),
  intl('Seize the day, and put as little trust as you can in tomorrow.', 'Horace', '抓住今天，尽量别指望明天。', '贺拉斯'),
  intl('Our life is frittered away by detail. Simplify, simplify.', 'Henry David Thoreau', '我们的生活消磨在琐碎里。简单些，再简单些。', '梭罗《瓦尔登湖》'),
  intl('Well done is better than well said.', 'Benjamin Franklin', '做得好，胜过说得好。', '本杰明·富兰克林'),
  intl('Knowing is not enough; we must apply. Willing is not enough; we must do.', 'Johann Wolfgang von Goethe', '知道还不够，还要去用；愿意还不够，还要去做。', '歌德'),
  intl('First say to yourself what you would be; and then do what you have to do.', 'Epictetus', '先告诉自己你想成为什么样的人，然后去做你该做的事。', '爱比克泰德'),
  intl('All we have to decide is what to do with the time that is given us.', 'J. R. R. Tolkien', '我们唯一要决定的，是如何度过被赋予我们的时间。', '托尔金《魔戒》'),
  intl('Nothing great was ever achieved without enthusiasm.', 'Ralph Waldo Emerson', '没有热情，从来成就不了任何伟大的事。', '爱默生'),

  // ── Elsewhere: courage and keeping on ──
  intl('The impediment to action advances action. What stands in the way becomes the way.', 'Marcus Aurelius', '行动的阻碍反而推动行动，挡在路上的东西，会变成路。', '马可·奥勒留《沉思录》'),
  intl('Waste no more time arguing about what a good man should be. Be one.', 'Marcus Aurelius', '别再争论好人应该是什么样子了，去做一个。', '马可·奥勒留《沉思录》'),
  intl('The unexamined life is not worth living.', 'Socrates', '未经审视的人生不值得过。', '苏格拉底'),
  intl('The best way out is always through.', 'Robert Frost', '最好的出路，永远是穿过去。', '罗伯特·弗罗斯特'),
  intl('Two roads diverged in a wood, and I — I took the one less traveled by, and that has made all the difference.', 'Robert Frost', '林中有两条路，我选了人迹更少的那一条，从此一切都不一样了。', '罗伯特·弗罗斯特《未选择的路》'),
  intl('Only those who will risk going too far can possibly find out how far one can go.', 'T. S. Eliot', '只有敢于走得太远的人，才可能知道一个人能走多远。', 'T. S. 艾略特'),
  intl('Man is not made for defeat. A man can be destroyed but not defeated.', 'Ernest Hemingway', '人不是为失败而生的。一个人可以被毁灭，但不能被打败。', '海明威《老人与海》'),
  intl('The world breaks every one and afterward many are strong at the broken places.', 'Ernest Hemingway', '世界击垮每一个人，之后，许多人在破碎处变得坚强。', '海明威《永别了，武器》'),
  intl('What does not kill me makes me stronger.', 'Friedrich Nietzsche', '那些杀不死我的，会让我更强大。', '尼采《偶像的黄昏》'),
  intl('He who has a why to live can bear almost any how.', 'Friedrich Nietzsche', '知道为什么而活的人，几乎能忍受任何一种活法。', '尼采'),
  intl('There is only one heroism in the world: to see the world as it is, and to love it.', 'Romain Rolland', '世上只有一种英雄主义，就是看清世界的本来面目，并且爱它。', '罗曼·罗兰《米开朗琪罗传》'),
  intl('In the midst of winter, I found there was, within me, an invincible summer.', 'Albert Camus', '在隆冬，我终于知道，我身上有一个不可战胜的夏天。', '加缪'),
  intl('The struggle itself toward the heights is enough to fill a man’s heart. One must imagine Sisyphus happy.', 'Albert Camus', '攀登顶峰的奋斗本身，足以充实人的心。应当想象西西弗斯是幸福的。', '加缪《西西弗斯神话》'),
  intl('Ever tried. Ever failed. No matter. Try again. Fail again. Fail better.', 'Samuel Beckett', '试过，失败过。没关系。再试，再失败，败得更好一点。', '塞缪尔·贝克特'),
  intl('Everybody thinks of changing humanity, and nobody thinks of changing himself.', 'Leo Tolstoy', '人人都想改变世界，却没有人想改变自己。', '列夫·托尔斯泰'),
  intl('Everything can be taken from a man but one thing: the last of the human freedoms — to choose one’s attitude.', 'Viktor Frankl', '人的一切都可以被剥夺，唯独一样不能：选择自己态度的自由。', '维克多·弗兰克尔《活出生命的意义》'),
  intl('I learned that courage was not the absence of fear, but the triumph over it.', 'Nelson Mandela', '我明白了，勇气不是没有恐惧，而是战胜恐惧。', '纳尔逊·曼德拉《漫漫自由路》'),
  intl('Never give in, never give in, never, never, never.', 'Winston Churchill', '永不屈服，永不屈服，永不，永不，永不。', '温斯顿·丘吉尔'),
  intl('If you can’t fly, then run. If you can’t run, then walk. If you can’t walk, then crawl. But whatever you do, keep moving forward.', 'Martin Luther King Jr.', '不能飞，就跑；不能跑，就走；不能走，就爬。无论如何，都要继续向前。', '马丁·路德·金'),
  intl('Life is not easy for any of us. But what of that? We must have perseverance and above all confidence in ourselves.', 'Marie Curie', '生活对我们谁都不容易。但那又怎样？我们必须有恒心，尤其要有自信。', '玛丽·居里'),
  intl('Life is either a daring adventure or nothing.', 'Helen Keller', '人生要么是一场大胆的冒险，要么什么都不是。', '海伦·凯勒'),
  intl('You must do the thing you think you cannot do.', 'Eleanor Roosevelt', '你必须去做那些你以为自己做不到的事。', '埃莉诺·罗斯福'),
  intl('Do what you can, with what you have, where you are.', 'Theodore Roosevelt', '在你所在之处，用你所有之物，做你能做之事。', '西奥多·罗斯福'),
  intl('How wonderful it is that nobody need wait a single moment before starting to improve the world.', 'Anne Frank', '多么美好啊，谁都不必再等片刻，就可以开始让世界变得更好。', '安妮·弗兰克'),
  intl('You may not control all the events that happen to you, but you can decide not to be reduced by them.', 'Maya Angelou', '你无法掌控发生在你身上的一切，但你可以决定不被它们打垮。', '玛雅·安吉洛'),
  intl('Life shrinks or expands in proportion to one’s courage.', 'Anaïs Nin', '生命随勇气的多少而收缩或舒展。', '阿娜伊丝·宁'),
  intl('Be patient toward all that is unsolved in your heart and try to love the questions themselves.', 'Rainer Maria Rilke', '对心中一切悬而未决的事保持耐心，试着去爱问题本身。', '里尔克《给青年诗人的信》'),
  intl('Tell me, what is it you plan to do with your one wild and precious life?', 'Mary Oliver', '告诉我，你打算怎样度过你这唯一的、狂野而珍贵的一生？', '玛丽·奥利弗《夏日》'),
  intl('To live is the rarest thing in the world. Most people exist, that is all.', 'Oscar Wilde', '生活是世上最罕见的事，大多数人只是存在着，仅此而已。', '王尔德'),

  // ── Elsewhere: sport and stories ──
  intl('You miss 100% of the shots you don’t take.', 'Wayne Gretzky', '不出手的球，百分之百进不了。', '韦恩·格雷茨基'),
  intl('I’ve failed over and over and over again in my life. And that is why I succeed.', 'Michael Jordan', '我一生中失败了一次又一次，这正是我成功的原因。', '迈克尔·乔丹'),
  intl('I can accept failure, everyone fails at something. But I can’t accept not trying.', 'Michael Jordan', '我可以接受失败，每个人都会失败；但我不能接受不去尝试。', '迈克尔·乔丹'),
  intl('The miracle isn’t that I finished. The miracle is that I had the courage to start.', 'John Bingham', '奇迹不在于我跑完了，而在于我有勇气出发。', '约翰·宾厄姆'),
  intl('Fall seven times, stand up eight.', 'Japanese proverb', '跌倒七次，第八次站起来。', '日本谚语'),
  intl('I’m not afraid of storms, for I’m learning how to sail my ship.', 'Louisa May Alcott', '我不怕暴风雨，因为我正在学着驾驭自己的船。', '奥尔科特《小妇人》'),
  intl('It is our choices, Harry, that show what we truly are, far more than our abilities.', 'J. K. Rowling', '哈利，决定我们成为什么样的人的，不是我们的能力，而是我们的选择。', 'J. K. 罗琳《哈利·波特》'),
  intl('Get busy living, or get busy dying.', 'Stephen King', '要么忙着活，要么忙着死。', '斯蒂芬·金《肖申克的救赎》'),
  intl('Hope is a good thing, maybe the best of things, and no good thing ever dies.', 'Stephen King', '希望是美好的，也许是世间最好的东西，而美好的东西永远不会消逝。', '斯蒂芬·金《肖申克的救赎》'),
  intl('After all, tomorrow is another day.', 'Margaret Mitchell', '毕竟，明天又是新的一天。', '玛格丽特·米切尔《飘》'),
  intl('Do. Or do not. There is no try.', 'Yoda, The Empire Strikes Back', '要么做，要么不做，没有‘试试看’。', '尤达大师《星球大战》'),
]
