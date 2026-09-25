GF.script(`
== c09_start
[chapter c09]
[hide all]
[rename zhangqing 卫不回]
[bio zhangqing 1]
[bg airplane fade]
[amb engine]
[bgm mystery]
[date 2004年7月1日 周四 夜 · 加德满都飞往上海的航班]
离落地上海还有四十分钟。我正盘算着下了飞机先吃碗大排面，还是来碗小馄饨——
身边传来一声极轻的抽气。
[show naduo left]
[show xiahouying right tired]
夏侯婴的脸，白得像一张纸。
汗珠顺着她的鬓角一颗颗往下滚。两只手死死扣着座椅扶手，指节都泛了青。
太阳穴上，一根青筋突突地跳。
naduo.shock: 夏侯小姐？你怎么了？要不要叫空姐？
xiahouying.tired: 不用……是头痛。老毛病，家里一代代传下来的。
xiahouying.tired: 熬过这一阵就好。你别管我。
她说“别管我”的语气，平淡得像在说今天有点热。可她咬着的下嘴唇，已经没有一点血色了。
动动手指就能把我从鬼门关拽回来的人，拿自己的脑袋却毫无办法。本事再大，总有一样治不了的病在前头等着。
[hide all]
[bg taxi fade]
[amb city]
[show naduo left]
[show xiahouying right]
直到出租车驶出机场，她脸上才一点点回了血色。
naduo: 好点了？
xiahouying.smile: 好多了。吓着你了吧？
naduo: 有一点。我还以为你要在三万英尺上给我表演一出晕倒。
xiahouying.smile: 那可不行。说好了要你带我下去的，我还没去呢。
[sfx car_door]
车停在四季酒店门口。上海数得着的豪华酒店，一晚的房钱，够我吃好几个月的盒饭。
xiahouying: 明早九点，就在这门口碰头？
naduo: 九点。我准到。
xiahouying.serious: 还有件事。墙上那些符号交给我；可孙辉祖背上那几十个窟窿，不是符号扎出来的。墓里有机关。
xiahouying.think: 卫先不在了，机关这一行，我是外行。本想先下去探一探再说——
naduo: 这个交给我。今晚我去请个人。
懂机关，又不用我把来龙去脉从头讲一遍的——全上海，只有那一位。
[hide all]
[bg sanceng_stairs fade]
[amb stop]
[bgm stop]
[date 2004年7月1日 周四 夜 · 中央“三层楼”]
[sfx footsteps]
木楼梯在脚底下吱吱呀呀地叫。二楼走廊尽头，还是那扇朱红色的门。
一路上我把说辞过了三遍：先提卫先，再提夏侯婴。他要是翻脸关门，我就把脚卡进门缝里……
[sfx knock]
[wait 600]
[sfx door_open]
[show naduo left]
[show zhangqing right serious]
zhangqing: 我等你很久了。
[bgm mystery]
我打好的第一句腹稿，卡在了嗓子眼里。
他就站在门里，一只手搭着门框，丝毫没有请我进去的意思。
naduo.shock: 等……等我？
从前见他，总觉得这人浸在一层灰里：眼睛是亮的，可亮光后头压着黄昏。今晚那层灰，像是被谁一把扯掉了。
zhangqing: 打算什么时候再下去？
naduo: 呃……明天。上午九点半左右。
zhangqing: 好。我去。
[sfx door_slam]
[hide zhangqing]
[shake]
砰——朱红门又一次拍在我的鼻尖前头。
我在门口傻站了足足半分钟。准备了一路的说辞，一个字都没用上。
从头到尾，话头都攥在他手里，我连插嘴的空当都没捞着。这做派……那个缩在这幢楼里六十多年的“天下第一”，醒了？
更怪的是，我还没开口，他就知道我要再下去。那地方他躲了六十多年，一提就变脸——怎么忽然就不躲了？
[hide all]
[bg nado_home fade]
[amb city]
[sfx pen]
[note 7月1日，周四。回到上海。飞机上夏侯婴头痛发作，她说是家里传下来的病。夜里去请卫不回，他开口第一句是“等你很久了”，问完时间就关了门。想不通。明早九点，四季门口，第二次下去。]

[hide all]
[bg street fade]
[amb city]
[bgm daily]
[date 2004年7月2日 周五 9:00 · 四季酒店门口]
三十六度。太阳还没爬到头顶，柏油路面已经开始往上冒热气。
[show naduo left]
[show xiahouying right]
夏侯婴准时出现在门口。我看了她一眼，差点以为自己中了暑。
一件宽宽大大的长袖衬衫，袖口扣得严严实实。
底下一条水绿色的长裙，一直垂到脚踝，走一步晃三晃。这位小姐是要去跳舞，还是去钻墓？
[choice 这身打扮……]
- 提醒她换条裤子 -> c09_outfit_warn
- 先夸一句好看 -> c09_outfit_praise

== c09_outfit_warn
naduo: 那个……要不要回去换条裤子？底下的路，一半得猫着腰爬。
xiahouying: 不用，走吧。
她像是压根没听见，抬手拦下了一辆出租车。
[jump c09_outfit_end]

== c09_outfit_praise
naduo: 这裙子挺好看的，颜色很衬你。就是底下全是土，蹭脏了怪可惜的……
xiahouying.smile: 谢谢夸奖。
我说得够委婉了。她大概听懂了，也大概压根没打算理会，抬手拦下了一辆出租车。
[jump c09_outfit_end]

== c09_outfit_end
[sfx car_door]
她钻进后座，一回头，瞧见我杵在车门外，一脸的为难。
xiahouying.smile: 放心。我不是那种为了好看，连轻重都不分的女人。
话说到这份上，我还能说什么？只好揣着一肚子问号，跟着钻进了车。
[hide all]
[bg sanceng_center fade]
[amb stop]
[bgm mystery]
[date 2004年7月2日 周五 9:34 · 中央“三层楼”]
钻进中央“三层楼”的门洞，表针正指着九点三十四分。
[bg sanceng_stairs fade]
[show naduo left]
[show xiahouying center]
naduo: 晚了几分钟。你等等，我上楼去叫他——
zhangqing: 不必。我在这儿。
声音是从一楼楼梯底下那团阴影里冒出来的——正是通往地下室的方向。
[show zhangqing right serious outfit=black]
卫不回从暗处走了出来。一身黑衣黑裤，要不是那双眼睛精光四射，我根本看不出那儿站着个人。
他真有八十多岁？我头一回对这个数字起了疑心。
naduo: 给两位引见一下。这是卫不回卫老，人称盗墓之王。
naduo: 这是夏侯婴。有她在，你我心里那点直觉，就再也拦不住咱们的脚了。
卫不回的目光在她脸上停了一瞬，像是在掂量“夏侯”这两个字。
zhangqing: 人齐了。下去吧。
[hide all]
[bg basement fade]
[fx dark on]
[sfx door_open]
[sfx door_close]
我们鱼贯钻进地下室。门在身后合拢，最后一线光也被关在了外头。
就在这时，黑暗里亮起了东西。
一个，两个，十几个……幽幽的绿光浮在半空，扭成一个个我从没见过的形状。
[shake]
[cg cg_glow]
等心跳缓过来，我才看明白：那件长袖衬衫，已经被夏侯婴脱下来搭在了臂弯里。底下是件白T恤，前前后后，用夜光颜料画满了符。
她又弯腰一扯，水绿长裙滑落下来——里面是条长裤，同样爬满了发光的笔画。
原来分不清轻重的，是我。
[cg off]
[show xiahouying center outfit=glow]
xiahouying: 夜光的，黑地里也看得见。
xiahouying: 看着它们，你们的心就定得住，墙上那些符钻不进来。——说穿了，这也是一种暗示，以毒攻毒罢了。
我盯着那片绿光看了几眼。胸口那块一路悬着的石头，像是被谁轻轻放回了地上。
[clue c_glow_symbols]
我暗暗打定主意：回头一定得跟她讨一件。穿去评报会，保管蓝头一句重话都骂不出口。
[hide all]
[fx dark off]
[bg tunnel fade]
[amb tunnel]
[bgm underground]
挪开书橱，爬下铁梯，我们三个猫着腰，又走上了孙家兄弟当年掘出来的那条甬道。
壁上的小铁盘一个接一个从手电光里掠过。认路的窍门早摸清了，这回不用再费脑子。
[show naduo left]
[show zhangqing right serious outfit=black]
naduo: 卫老，昨天那句“等我很久”，我琢磨了一整夜。
zhangqing: 琢磨出什么了？
naduo: 卫先头一回见您，回去就给家里报了信。他出事以后，警察连他是谁都还没查清，您那帮本家倒先知道了。
naduo: 他们上门请您回去坐镇，顺手把噩耗带到了。外加一份我的底细——我没猜错吧？
zhangqing: 厚厚一沓。比你自己记得的还全。
六十多年前，这座墓吞了他的同伴；六十多年后，又吞了他的侄孙。这一刀，正扎在他心底最疼的那根筋上。
zhangqing.serious: 我这号人，本来就该死在地底下。
zhangqing.serious: 不敢下地，已经太久了。那就拿这座墓，当我重新出山的头一站。
东山再起，他偏偏挑了当年摔得最狠的这个坑。
naduo: 可您没自己闯。您在等我。
zhangqing: 能从那道门前活着退回来的人，不会甘心。你这种人，回来之前，必定把家伙备齐。
zhangqing: 我等的，就是你备齐的那套家伙。再说——我看你小子，也不像短命的相。
naduo: ……这算是夸我？
zhangqing.smile: 算。
[hide all]
[bg slab_room fade]
甬道到了头。那块几吨重的扁石还斜靠在一边，旁边就是那道往下延伸的青石阶。
[show xiahouying center outfit=glow]
xiahouying: 就是这底下？
[show naduo left]
naduo: 对，就是这儿。
[show zhangqing right serious outfit=black]
卫不回站在石阶口，胸膛慢慢地鼓起来，又慢慢地瘪下去。
那一口气，他在心里憋了六十七年。
[hide all]
[flashback on]
[bg corridor_dark fade]
[bgm oldtimes]
[show zhang37 center fear]
六十七年前，也有一个年轻人提着灯，走下了这道石阶。
他跟在孙家四兄弟身后，却在远远望见那道拱门的时候，停住了脚。
那一停，他活了下来。也停住了自己的后半辈子。
[hide zhang37]
[flashback off]
[bg slab_room fade]
[bgm underground]
[show zhangqing right serious outfit=black]
他抬脚，第一个踏上了石阶。我和夏侯婴一前一后，跟了下去。
[hide all]
[bg corridor_dark fade]
[sfx footsteps]
卫不回在黑暗里摸到了那只铜墩。
[sfx whoosh]
[bg corridor flash]
[amb fire]
[bgm tomb]
轰——轰——一团团火苗接力似的朝远处蹿去。万年连珠灯，第二次为我点亮。
石壁上的纹路在火光里扭动起来。尽头那具白骨，还是上回的姿势，趴在那儿等人。
上回站在这里，我的心跳快得像擂鼓。这回我侧过头，找到那片绿光——鼓声就歇了。
[show naduo left]
[show xiahouying center outfit=glow]
[show zhangqing right outfit=black]
zhangqing: 这条道上没有机关。放心往前走。
夏侯婴点点头，走在最前面。我和卫不回一左一右，落后她半步。
她几乎是一步一停，脸凑近墙面，去辨认那些藏在石纹里的笔画。看一处，点一下头，像在批改一份早就知道答案的卷子。
拱门越来越近。我和卫不回对了个眼神，他冲我微微颔首。上回压得人喘不过气的那股东西，这回连影子都没摸到我们。
[hide all]
[bg tomb_gate fade]
[show naduo left]
[show xiahouying center outfit=glow]
[show zhangqing right outfit=black]
孙辉祖的白骨，就横在脚边。
xiahouying.shock: 咦——这颗头是怎么回事？
她指着那只被白骨死死扣住的骷髅头。眉心上方，那个黑洞洞的“第三只眼”。
我这才想起来：在尼泊尔讲给她听的时候，偏偏把这一节给漏了。
naduo: 多半是墓主人的脑袋。也不知怎么被孙辉祖拧了下来，一路攥到了这儿。
[cg cg_skull]
夏侯婴慢慢蹲下。她的目光没在眼眶、牙床上停留，直直钉住了眉心上方那个圆洞。
隔着那身绿光，我看见她的肩头在轻轻打颤。
[cg off]
卫不回在旁边吐出一口长气，也说不清是在叹谁。能叫人修这么大一座墓的脑袋，到头来，被个疯子攥在手里攥了六十七年。
xiahouying.sad: 原来……那个传说是真的。
[show xiahouying center sad outfit=glow]
她站起身，身子晃了一晃。我赶紧伸手扶住。
naduo: 怎么了？
xiahouying.sad: 没事。就是……有点失望。
嘴上说“有点”，可她脸上那层灰败，哪里是一点两点。
xiahouying.serious: 进去吧。我本来想要的，已经拿不到了。不过那本书，还是带走的好。
上一回，我就是在这里拼了命，才把卫先喊住。
这一回，我跟着她和卫不回，跨过了那道拱门。
[hide all]
[bg black fade]
[amb stop]
[bgm stop]
卫不回在漆黑的门边摸索了几下——
[sfx whoosh]
[bg heart_fear flash]
[bgm tomb]
[amb fire]
眨眼工夫，满室灯火齐明。这里也藏着连珠灯的机关，他找起开关来，比我在家摸电灯还快。
[show naduo left]
[show xiahouying center outfit=glow]
[show zhangqing right serious outfit=black]
卫先下墓，恨不得把半个五金店背在身上。他这位四叔公，只带一根金属棒。
[sfx tap]
棒头在地上笃笃点了几下。他直起腰——
[show zhangqing right fear outfit=black]
脚后跟却自己往后挪了半步。
他的眼睛飞快地找到了夏侯婴身上的绿光，钉在那儿，好一会儿才挪开。
xiahouying.serious: 是恐惧。这间屋子四面墙上的符，暗示的都是恐惧。
灯火亮起的那一瞬，我心里也掠过一层凉意，淡得像隔着毛玻璃。要不是有这身“活体符”挡在前头，我大概已经扭头往回跑了。
zhangqing.smile: 嘿嘿……老头子也学会杯弓蛇影了。
zhangqing: 这屋里多半干净。不过稳妥些——都跟在我身后走。
xiahouying: 有这四面墙就够了，用不着机关。你们身上压着我的安神符，还能觉出一丝凉——换个没防备的人来呢？
xiahouying: 灯都不用点，黑地里往前一步，就得吓得掉头。可他来的路上已经吃过墓道里那口死气，掉头出去，也活不长。
灯光下，这间屋子空旷得吓人：四五百平米，一件摆设也没有。轮廓歪歪斜斜，像谁在地上滴了一滴巨大的墨。远处那头，另一道拱门在等着。
zhangqing: 你们看地上。
他的金属棒点着地面，一路点向对面。我弯下腰，才看清白石头里洇着一串发乌的斑点，淡得像水渍，从脚边一直连到那道拱门。
naduo.shock: 是孙辉祖的血！
zhangqing: 渗进石头里去了。这一路，没有机关发动过的痕迹。
xiahouying.think: 走吧。外面是死亡，这里是恐惧。过了那道门，暗示的东西怕是又要换一样。
卫不回抬脚之前，又回头往她身上的绿光狠狠剜了一眼。我假装没看见——刚才我自己也这么干过。
[hide all]
[bg heart_despair fade]
[show naduo left]
[show xiahouying center outfit=glow]
[show zhangqing right serious outfit=black]
到了第二道拱门，卫不回收住脚，我们也跟着停下。
门后面不是屋子，是一段拐着弯的窄道，弯过去就看不见了。地上那串乌黑的血点，也跟着拐了进去。
六十七年前，一个背上插满铁箭的人，就是沿着这条弯道，一边淌血一边往外狂奔。
naduo: 这儿好像也没发动过什么。这条道也是空的？
卫不回没搭腔，整个人伏低下去，侧脸几乎贴上石面，像在瞄一条看不见的线。瞄完，又拿金属棒笃笃点了几下。
[sfx tap]
[sfx tap]
zhangqing.serious: 有机关。只是从来没响过。
xiahouying.shock: 没响过？孙辉祖当年从这儿冲出去，都没把它踩响？
zhangqing: 这里的机关，发作的法子古怪。你正常走、拔腿跑，它都不理你。
zhangqing.serious: 偏偏是你站住不动，它才要你的命。
xiahouying.think: 那就说得通了。
xiahouying: 往前看的时候，你们没觉得……跟刚才那间，滋味不太一样？
我往弯道深处望了一眼，拿心去掂量。不是冷，也不是怕……是种软塌塌、提不起劲的东西，一时找不着词儿。卫不回拧着眉，看样子也卡在同一处。
xiahouying: 隔着我的符，你们只尝到一点边儿，自然叫不出名字。这一段墙上画的，是沮丧。
naduo.think: 沮丧？
这两个字往心里一贴，严丝合缝。
zhangqing.serious: 懂了。人灰心到底，要么蹲下抱头哭，要么杵在原地发愣。
zhangqing.serious: 哭也好，愣也好，脚都停了。脚一停——
xiahouying: 符不直接杀人，只管让你停下。剩下的，交给机关。一唱一和，天衣无缝。
naduo: 那孙家兄弟当年怎么就平平安安过去了？
话一出口，我自己就想到了答案。
xiahouying: 那是因为——
naduo: 旗。
xiahouying.smile: 对。那半面旗我仔细看过。旗面上的符有两套：一套朝外，吓唬远处的敌人；一套朝里，护着扛旗的人。
xiahouying: 朝里那套，跟我这身衣服是一个路数。只是一面旗要身兼两职，护身这头就薄了些。
naduo: 说到旗——当年他们扛着它满世界找墓，一到闸北，旗上的恐惧一下子强了十倍。这是什么道理？
xiahouying.think: 这个我答不上来。祖上传下来的，大多是“怎么画”，很少讲“为什么灵”。
xiahouying.serious: 眼下要紧的是另一件事。站在门口看，和走进去，是两回事——一进去，那股灰心会翻上好几倍。到时候，脚千万别停。
xiahouying: 单单一两道符，得让人看见了才起效。可要是成百上千道照着规矩排成一片，看不看得见，它都在那儿发力。
xiahouying: 老辈人管这个叫“阵”。——不是两军对垒摆的那种阵，别弄混。
naduo: 这个我懂。
我当然懂。当初在神农架那个人洞里，萧秀云摆的困龙秘阵，差点把我活活困死在里头。
xiahouying.shock: 你见识倒不少。
xiahouying: 要借个现在的说法，大概是“场”——像磁铁周围那一圈看不见的力。符排成阵，就往四周放出一圈精神上的场，谁走进圈里，谁就被它攥住。
xiahouying.serious: 两个场要是撞在一起……可能什么都不发生。也可能——
她没往下说。我却已经听明白了。
当年闸北街头那场“心灵风暴”，就是旗上的场，和地底下的场撞在了一起。
至于为什么只在那一刹那炸开，过后又风平浪静——不弄明白这些符号是怎么设计出来的，光凭我们几个瞎猜，是猜不出来的。
[checkpoint]
zhangqing: 走。记住，别停。
[bgm tension]
[fx heartbeat on]
[game despair_walk lose=c09_be_despair]
[fx heartbeat off]
[bgm tomb]
三个人埋头疾走，那架势，拿去参加竞走比赛也不丢人。心里早有防备，灰心的滋味涌上来，也只在脚边打了个转。
弯道到头，又是一道拱门，比前一道宽出一截。卫不回伸手一拦，我们三个肩膀挤着肩膀，在门洞底下站成一排。
[jump c09_anger]

== c09_be_despair
[fx heartbeat off]
[bgm stop]
[fx blur on]
不知是第几步，脚底下忽然没了往前迈的理由。
走下去又怎样？前面是墓道，墓道尽头还是墓道。
我只是想站一小会儿。就一小会儿。
卫不回在前头回身吼了一句什么。我听见了，却懒得去听懂。
[sfx stone]
咔哒。脚下的石板轻轻一沉，墙缝深处，有什么东西开始转动。
原来绝望是这么安静的一件事。它甚至不让你觉得害怕。
[fx blur off]
[ending be_despair]

== c09_anger
[hide all]
[bg heart_anger fade]
[fx redtint on]
[bgm dread]
门里的地方，像被人一刀削出来的楔子：脚下这头最宽，越往里越瘦，削到尽头，只剩一道得侧着身才挤得过去的小门。
地上摊着三副骨架。四下里撒满了短短的铁箭——外面孙辉祖背上插的，就是这个。
孙家四兄弟，外头一个，这里三个。一家人，总算凑齐了。
[show naduo left]
[show xiahouying center serious outfit=glow]
[show zhangqing right serious outfit=black]
xiahouying.serious: 愤怒。
不用她点破。一股闷火，已经在我胸口里拱来拱去了。
三具白骨中间，扔着一片布，明黄的颜色一点没褪。能六十多年不烂的料子，只有那面旗。
zhangqing.serious: 孙家那几个，外加当年跟着他们的我，全是半桶水。这间屋子，错半步就要命。
naduo: 可四面都是光溜溜的大理石，箭打哪儿射出来？
zhangqing.angry: 笨蛋！看着光溜，里头好些是活板。机关一触，板子翻过来，箭就在后头等着。
挨了骂，我没吭声，心里却想：他再是盗墓之王，要不是有夏侯婴那身符压着，这会儿早被火气顶得两眼发红，哪块石头能踩，还分得清？
孙家兄弟恰好反过来：旗护住了心，脚下的门道却一窍不通。一个缺一样，下场都一样。那面旗，就是在这里被扯成两半的。
卫不回低头在背包里翻找着什么。我望着眼前这个三角，心里忽然一动。
naduo.think: 等等。你们把咱们走过的路在脑子里过一遍——先是一滴水，再是一段弯道，然后是这个三角……
naduo.think: 弯道接三角，笔画上，这不就是一个钩？这几间屋子，是照着一个字盖的。
卫不回的手停住了，抬头看我。
[deduce d_heart]
xiahouying: 你也看出来了？
她以指代笔，在半空里慢慢写下一个字。
[cg cg_heart]
水滴那间，是起笔的一点；弯道连着三角，是那一道卧钩。她指尖在空中收住的，是一个行书的“心”。
[cg off]
xiahouying: 暗示，从来都是对着人心下手的。
naduo: 人心？不该是大脑吗？
xiahouying: 谁告诉你念头住在大脑里？解剖过那么多颗脑袋，有谁从里头找着过魂？
xiahouying: 我说的心，不是胸口里那块肉，是一个人最早生出念头、生出灵性的源头。我指不出它在哪儿，可我知道它在。
naduo: 那“心”字还差两点。最末一点，该是停棺的地方。
xiahouying: 放棺材的屋子，照规矩是干净的，不画符。所以前面还剩一间有符的。
xiahouying.serious: 恐惧，沮丧，愤怒。下一间是什么，不会是好东西。
卫不回这时才从背包里翻出要找的东西：一只小瓶。他拧开，往两只鞋底各抹了一层红。
zhangqing: 我在前面趟路。你们只准踩我的红印子。踩歪了——
zhangqing: 就等着给人当箭靶，扎成刺猬。
[hide zhangqing]
他往里走，走得极慢。身后的大理石上，一个接一个开出红色的脚印。
第三步，他忽然定住了。两只拳头在身侧攥得死紧。
[fx heartbeat on]
[sfx heartbeat]
我连气都不敢喘。数到七，他的肩膀才松下来，脚又抬了起来。
[fx heartbeat off]
那串红印子七拐八绕，从三副骨架中间穿过去，一直通到尽头的小门。卫不回在门下转身，冲我们勾了勾手指，又低头去给鞋底上色。
夏侯婴在前，我在后。
[checkpoint]
xiahouying: 跟紧我。眼睛发花的时候，就看我背上。
[game footprints lose=c09_be_arrows]
他的步子忽长忽短，跟着踩，像在走一根时松时紧的钢丝。好几次身子一歪，我才懂了，刚才卫不回为什么要停。
一进屋，火气比在门口时翻了一番。好几回我想扭头冲谁骂一句，还好一抬眼，就是前面那片绿光。
最要命的是尺码。卫不回那双脚，比我的小了两号。我踩得再正，鞋边也要漏出一圈在红印子外面。
走到白骨旁边，一脚下去，半个鞋底都悬在印子外头。后背的汗唰地冒了出来。——能冒汗，就说明箭还没到。
[jump c09_arrow_hit]

== c09_be_arrows
[fx redtint off]
[bgm stop]
那一脚落下去，脚后跟压住了红印外面的一小块石头。比指甲盖大不了多少。
[sfx stone]
脚底的石板一翻，像一只眼睛冷冷地睁开了。
[sfx arrows]
[flash red]
[shake strong]
尖啸声从四面八方同时扑过来。
我最后看见的，是夏侯婴回头时背上那片绿光，一下子糊成了一团。
六十七年前，这里倒下了三个人。今天，是第四个。
卫不回说得一点没错。变刺猬，只差半只脚。
[ending be_arrows]

== c09_arrow_hit
夏侯婴离小门只剩几步了。那头，卫不回的鞋底上好了色，抬脚跨进了下一间——
[sfx arrow]
[flash red]
[shake strong]
“嗖”的一声锐响。紧跟着一声压在喉咙里的闷哼，卫不回捂着左肩，踉跄着倒退回门洞底下。
[sfx arrows]
铁箭撞在石头上，叮叮当当乱跳，好半天才静下来。我脑子里只剩一个念头：连他都会踩错？
[show naduo left]
[show xiahouying center shock outfit=glow]
[show zhangqing right tired outfit=black]
zhangqing: 都别动。
用不着他吩咐。门洞里只塞得下他一个，夏侯婴离他一步，我离她两步——想往前，没地方；想往后，那是找死。
在这间屋子里，连“站住”都有讲究：一只脚已经迈了出去，就只能这么撑着，不能收，也不能换。
于是我和夏侯婴一前一后，定格成两尊迈步的铜像。放在别处，这造型够人笑半年；在这儿，我连嘴角都不敢动。
xiahouying.shock: 出什么事了？前头的机关闯不过去？
zhangqing: 是我踩错了。
他从背包里掏出纱布，三两下把伤口扎紧，又往脚底补了一层红。
naduo.shock: 连您都……这么厉害？
zhangqing.serious: 机关不算什么。是墙上那些鬼画符。
zhangqing: 你们怎么样我不知道。我是一道门比一道门难熬，那些东西像钉子，一寸一寸往脑子里敲。
zhangqing: 刚进去两步，脚底下就飘了。落地那一下就知道坏了，缩得快，才只赔了块肉。
zhangqing.smile: 箭头是干净的，没喂毒。老天还肯给我留口饭。
naduo: 我这一路，也是越走越难熬。前面那间的符号，冲的是什么？
zhangqing: 像是火，又比火邪。脚一踏进去，就想扯着嗓子嚎，把什么都砸个稀烂。
xiahouying.serious: 是疯狂。有一种暗示，能把人逼疯。
naduo: 夏侯小姐，这下怎么办？
xiahouying: 怪我，没算到这一层。这几间的符号，劲儿是一层层叠上去的，人心里所有的坏情绪都被翻了出来。
[clue c_heart_rooms]
xiahouying: 卫老先生，您往鞋底抹的颜料，借我用用。
zhangqing: 接着。
他把那只小塑料瓶朝她抛了过去。夏侯婴一把接住，拧开盖子，食指蘸了一点。
xiahouying: 右手给我——您左肩伤着。我在您手心再添一道符，走的时候眼睛就盯着它，四面墙上的东西就钻不了那么深。
xiahouying: 只是走路还得分神看手，您多担待。
zhangqing.smile: 分神？总好过发疯。
他探过身，把右手递给她。画完，转身，又一次跨进了那道拱门。
[hide zhangqing]
[fx heartbeat on]
拱门那头静了两秒，才传来一句沙哑的“这回行了”。我吊着的心，这才落回了原处。
[fx heartbeat off]
很快，我也挪到了夏侯婴刚才站的位置，把手伸给她。
她尖尖的指尖，在我掌心里画来画去——
[choice 痒得钻心……]
- 咬牙忍住 -> c09_palm_endure
- 手一缩 -> c09_palm_flinch

== c09_palm_endure
我屏住气，把手掌绷得笔直。那股痒从掌心一路爬到后脖颈，鸡皮疙瘩起了一层又一层。
naduo: 没事没事，你画你的……嘶——
[jump c09_palm_end]

== c09_palm_flinch
手指头不听使唤，自己往回一缩。
xiahouying.angry: 别动！画歪一笔，这道符就白画了。
naduo: 对不住对不住……我从小就怕痒。
[jump c09_palm_end]

== c09_palm_end
为了不去想掌心那点痒，我没话找话。
naduo: 我总算想通了，孙辉祖怎么会拧个死人脑袋冲出去。
[hide all]
[flashback on]
[bgm oldtimes]
[show sunhuizu center angry outfit=flag]
这一间是愤怒。旗一扯破，护身的东西没了，他当场就中了招。
他一身硬功夫，铁箭一时半会儿要不了他的命。可亲兄弟一个接一个，就倒在他眼前。
[sfx arrows]
[shake]
怒火冲天，他只想替兄弟们报仇，一头朝里面撞了进去。下一间是疯狂——等于往火上又浇了一桶油。
疯子是不知道疼的。满背的箭，他就那么扛着，拧下墓主人的脑袋攥在手里，一路冲回外面的墓道，才终于倒下。
[hide sunhuizu]
[flashback off]
[bgm dread]
[show naduo left]
[show xiahouying center sad outfit=glow]
夏侯婴收回手，没接我的话，只低低叹了一声。
然后她转过身，踏上了下一个红印子。
[fx redtint off]
[hide all]
[bg heart_madness fade]
[fx tilt on]
[sfx whisper]
果然，下一间又是圆圆的一“点”。地上铁箭横七竖八，六十七年前的和十分钟前的混在一起，谁也认不出谁。
这箭能一射再射，墙里多半藏着会自己上弦的机簧。孙辉祖当年拿身子替它趟过一遍雷，它歇了六十七年，照样出箭。
墙上的符号扭成一团，看久了，像在慢慢蠕动。耳朵里有人在笑，又好像是我自己在笑。
低头。看掌心。踩脚印。
[game madness_palm]
[fx tilt off]
等那阵嗡嗡声从耳朵里退干净，我脚下已经踩上了一块青石——最后一间，到了。
[hide all]
[bg coffin_room fade]
[amb stop]
[bgm mystery]
这里的墙换成了大块青石，素净得像刚洗过，一道符也找不着。卫不回敲了一圈，也没敲出机关。
屋子正中，一口玉棺大得像张床。棺盖碎成了好几瓣，横七竖八躺在地上。
[show naduo left]
[show xiahouying center outfit=glow]
[show zhangqing right tired outfit=black]
我有点意外。这位墓主人的身份一定尊贵得吓人，可王侯下葬，动辄好几间石室堆满陪葬。这里，只有一口棺。
[cg cg_coffin]
孙辉祖的疯劲，全撒在了棺里的人身上：陪葬的东西他一件没碰，那副骨架却被扯得散了架——脊骨断成几截，右胳膊齐着上臂脱了下来，没有头的躯干斜靠在棺壁上。
原先怎么摆的，还看得出个大概：左手边码着兵器，右手边堆着竹简，脚下一排酒器。如今全搅成了一锅粥。
[cg off]
夏侯婴两手撑在棺沿上，低头望着那具没有头的骨架，很久没有出声。
zhangqing.sad: 活着的时候，何等的英雄人物。霸业转头空，到头来，连一副骨头都保不全。
这一路上，夏侯婴对墓主人的名字绝口不提，我看得出她心里有数。她救过我的命，她不说，我就不问。可卫不回这口气——他也知道？
naduo: 您知道这是谁？
zhangqing: 笑话。我年轻时候为它熬了多少个通宵，会不知道底下睡的是谁？
zhangqing: 倒是你，都站到棺材跟前了，还没想明白？
我脑子里飞快地过了一遍：
三国的军旗。能让敌人闻风丧胆、又让自己人热血沸腾的符。
遗图上的会稽郡——这里是吴地。可孙家是来找东西的，躺在这儿的，不会是他们的祖宗。
一个姓夏侯、被头痛折磨的姑娘……还有头骨上那个洞。
[deduce d_owner]
naduo.shock: 难道是……曹……曹操？
zhangqing: 磨蹭到这会儿才转过弯来？没错。躺在这儿的，就是曹孟德。
[shake]
[sfx heartbeat]
名字是我自己说出口的，可真听人坐实了，脑子里还是轰的一声，舌头都打了结。
中国历史上头一号的枭雄。魏国之主。挟天子以令诸侯。死后据说设了七十二座疑冢，叫后人猜了一千八百年——
他就躺在这里？
[clue c_caocao]
zhangqing: 姑娘姓夏侯。跟他，怕是沾亲带故吧？
曹？夏侯？我脑子里把《三国志》哗啦啦翻了一遍，这才想起来——
曹操的父亲曹嵩，原本姓夏侯，拜了大宦官曹腾做养父，才改了姓。
夏侯氏是大族。曹嵩这一支分出去以后，其余的人照旧姓夏侯。曹操手下的夏侯惇、夏侯渊，说到底都是他的本家兄弟。
xiahouying: 曹操那一支，算是旁系。往下数，我是他之后的第五十七代。
naduo.shock: 这么说……原来是曹操长了第三只眼！
xiahouying.think: 什么第三只眼？
naduo: 他头上啊。两道眉毛正中间，再往上一点，还有一只眼睛。
她这才明白我在说什么，摇了摇头。
xiahouying: 那不是第三只眼。
naduo: 不是……那是什么？
这回连卫不回都转过脸来看着她。他显然也想知道。
xiahouying.sad: 这是我们族里自家的事。说是秘密，倒也谈不上。你们想听，我就讲。
xiahouying: 心字墓室墙上的暗示符，还有我身上画的这些，都是我们夏侯一族几千年传下来的学问。
xiahouying: 这门学问深不见底，威力也大得吓人。可它有个要命的毛病——学的人，会染上一种说不出来由的头痛。
xiahouying: 钻得越深，疼得越凶。大概你一刻不停地往别人心里钉钉子，锤子也在一下下震着自己的脑袋。
我一下想起了飞机上那一幕。原来那不是什么寻常的遗传病，是这门学问要她付的账。而史书上的曹操，不就是死于头风？
xiahouying: 族里历代修为高的人，差不多都是被头痛折磨死的。疯掉的，更是数都数不过来。
xiahouying: 所以近一百年，族里肯碰这些符号的人，一代比一代少。
xiahouying.tired: 我小时候，祖父怕这门手艺断在他手里，就教了我一点。没想到我一沾就上了瘾，学得还特别快。十四岁以后，就疼得很厉害了。
xiahouying: 曹操是族里记着的天才。论暗示，从来没人超过他。要不是把这门功夫练到了化境，他坐不稳中原，更别想把天子攥在手里。
我嘴巴都合不拢了。那么多猛将谋士，一个个死心塌地跟着他——原来除了他的雄才，还有一只看不见的手，一直在他们心上轻轻地拨。
到了战场上，这门功夫更是如虎添翼——那面军旗，就是现成的例子。
xiahouying: 族谱上记着：他在中原修了好几座假坟。天下人都想，他的坟还能出了魏国的地界？
xiahouying: 可他早跟吴主私下立了约——他死后，埋到江南来；魏国的大军，从此不过长江。
xiahouying: 所以你看魏国后来用兵，矛头总是朝着蜀，东吴反倒落得清静。到最后，吴比蜀多撑了十七年。
xiahouying: 就连在吴地选址，他也挑最偏的山野，又摆了几处疑兵，再拿暗示把痕迹抹干净。吴主不知道，我们夏侯家，也不知道。
xiahouying: 在尼泊尔听你一讲，再看见那面旗，我就知道你进的是曹操的墓。
xiahouying: 书上都说他是头风发作死的。我不信——或者说，不愿意信。这病缠了我这么多年，我总想，族里最了不起的那个人，总该找到过一条活路。
xiahouying.sad: 他是找过。外面那颗头骨，已经把他找到的路告诉我了。
我心里其实已经隐隐有了答案。只是这答案，未免太吓人。
[deduce d_hole]
naduo: 难道是……
zhangqing.shock: 华佗开颅！
夏侯婴还没开口，卫不回已经替她喊了出来。
她缓缓点了点头。
[clue c_huatuo]
野史里的版本，人人都听过：曹操头风难忍，召华佗来治。华佗要劈开他的脑袋取病根，曹操疑心这是行刺，把人下了大狱。一个死在狱里，一个死于头风。
原来真相是：曹操最后点了头。
可这场超前了一千多年的手术，终究没能成功。曹操死了，华佗自然也活不成。
夏侯婴盼了这么多年的解药，早在一千八百年前，就有人拿命试过了。
[sfx page]
夏侯婴转到棺的右侧，在散乱的竹简里拨弄了一阵，抽出来的却不是竹简，是一卷软软的卷轴。
那料子我认得——摸着像丝又像布，一千多年不朽不烂，跟那面军旗一模一样。
xiahouying: 果然在这里。写的是他用暗示的心得，一条一条的法门。孙家找了一千多年的，就是这个。
xiahouying: 找到又怎样。这东西，不是翻两遍就能上手的。
naduo: 这……是什么书？
她把卷首朝我亮了亮。
[deduce d_book]
[doc doc_xinshu]
我的眼睛一下子直了。
[clue c_xinshu]
naduo.shock: 《孟德心书》！
naduo.shock: 原来是这个“心”！不是新旧的那个“新”……
naduo.think: 可史书上不是说，曹操写过一部兵书叫《孟德新书》，写完嫌不好，自己一把火给烧了吗？
zhangqing.smile: 哈哈哈！史书上的话，错得多了，哪能句句当真。
zhangqing: 我这辈子钻过的墓，比你读过的书还多。棺材里躺着的真相，随便翻出一件，史学界那帮老先生就得连夜改教材。
zhangqing.smile: 这一趟，也不过是其中一件。——盗墓的乐趣，就在这里！
夏侯婴把卷轴贴身收好。卫不回已经毫不客气地在兵器和竹简里挑拣起来。
zhangqing: 小子，别光站着看。入了宝山还空着手回去，传出去我都替你臊得慌。挑一样。
naduo: 我？……这可是曹操的东西。
[choice 棺中之物，拿哪一样？]
- 脚边那套青铜酒器：一壶，两杯 -> c09_take_bronze
- 什么都不拿 -> c09_take_nothing
- 兵器堆里那柄长剑 -> c09_take_sword

== c09_take_bronze
[flag took_bronze]
[item add i_bronze]
我犹豫了好一阵，终于蹲下去，从乱成一团的酒器里捧起一盏青铜酒壶，又拣了两只青铜杯。
沉甸甸的。壶身上的绿锈摸上去，凉丝丝的。
zhangqing: 眼光还凑合。
naduo: 往书橱里一摆，谁也想不到，这是曹丞相喝过酒的家伙。
[jump c09_take_end]

== c09_take_nothing
[flag chose_nothing]
naduo: 算了。我什么都不拿。
卫不回从鼻子里哼出一声冷笑。
zhangqing.angry: 读书人的臭毛病。站在金山上喊穷的，我这辈子见得多了。
naduo: 我就是个跑新闻的。曹丞相的东西摆在家里，我怕半夜睡不着觉。
[jump c09_take_end]

== c09_take_sword
[flag asked_sword]
[flag took_bronze]
[item add i_bronze]
那柄长剑躺在兵器堆里。一千八百年过去，剑身上竟找不出一点锈迹。
我刚伸出手——
zhangqing: 这个我要了。
一只枯瘦的手抢先按在了剑柄上。快得我都没看清，他是什么时候到跟前的。
naduo: ……您老不是让我挑吗？
zhangqing.smile: 让你挑，没让你挑这个。那边的酒器，随你拿。
我只好悻悻地蹲下去，捧起一盏青铜酒壶，外加两只青铜杯。
[jump c09_take_end]

== c09_take_end
夏侯婴回过头，又看了一眼玉棺里那具没有头的骨架。
xiahouying.sad: 走吧。
她没再多说一个字。
[hide all]
[bg corridor fade]
[bgm sorrow]
[amb fire]
我们沿着脚印，原路退了出去。
身后，连珠灯还一盏接一盏地烧着，照着那位没有头颅的枭雄。
这些灯能烧好几个月。也不知道下一个走进来的，会是什么人。
[amb stop]
[chapterend]
[jump c10_start]
`);

// 建议新增：背景 fourseasons（四季酒店门口，7/1 下车、7/2 碰头两处用到）；目前分别以 taxi / street 代替。
