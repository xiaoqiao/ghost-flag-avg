GF.script(`
== c10_start
[chapter c10]
[sanity hide]
[rename zhangqing 卫不回]
[bgm stop]
[bg basement fade]
[fx dark on]
[date 2004年7月2日 周五 · 中央“三层楼” 地下室]
[amb drip]
[sfx footsteps]
铁梯一格一格往上爬，头顶那方洞口，终于从墨黑熬成了灰。
我头一个翻上来，趴在钱六那间地下室的水泥地上，大口喘气。霉味扑鼻——活了二十多年，头一回觉得霉味也这么香。
[show naduo left tired]
[show xiahouying center outfit=glow]
[show zhangqing right outfit=black]
说句不好听的，我们几个刚刚抄了一位枭雄的家。
夏侯婴怀里只护着那卷似丝非丝的东西——《孟德心书》。别的宝贝，她正眼都没瞧过。
卫不回收成最好：一卷竹简，一盏黄玉酒壶，外加那柄一千多年都没长锈的长剑。左肩的箭伤裹着纱布，一点不耽误他抱东西。
naduo.think: 我原以为帝王的墓里是金山银山，结果一路走到头，连块金锭都没碰上。
xiahouying: 书、兵器、酒。他活着的时候，最离不开的就是这三样。
xiahouying: 金银他瞧不上。能跟他一起躺进去的，只有真心喜欢的东西。
naduo: ……倒是个活明白了的人。
[if asked_sword -> c10_split_sword]
[if took_bronze -> c10_split_bronze]
[if chose_nothing -> c10_split_empty]
[jump c10_split_bronze]

== c10_split_bronze
我的背包也不轻：一盏青铜酒壶，一对青铜杯。
在棺材跟前我磨蹭了好半天，最后是卫不回那句“入了宝山还空着手回去”，把我推了过去。
zhangqing.smile: 进了宝山，总算没空着手出来。还行，没给我丢人。
naduo.smile: 我又不是您老的同行。
zhangqing: 跟我下过这一趟，你就算半个了。
[if item:i_bronze -> c10_split_merge]
[item add i_bronze]
[jump c10_split_merge]

== c10_split_sword
我原本相中的是那柄长剑。可卫不回手一伸，比我快了半拍。
zhangqing.smile: 剑挑主人。落到你手里，顶多拿去切西瓜。
naduo.tired: ……所以我只配端酒壶。
于是我的背包里，躺着一盏青铜酒壶和一对青铜杯。
[if item:i_bronze -> c10_split_merge]
[item add i_bronze]
[jump c10_split_merge]

== c10_split_empty
只有我，两手空空。
zhangqing: 空着手爬上来，这会儿后悔没有？
naduo: 我是记者，又不是贼。
话说得挺硬气。可心里总有那么一丁点儿说不清的东西，在轻轻地挠。
[jump c10_split_merge]

== c10_split_merge
zhangqing: 东西我先搬上楼。你们俩，道个别吧。
他把长剑往右腋下一夹，拎起那包竹简和酒壶就上了楼梯。脚步轻得不像个八十多岁、肩上还挂着彩的人。
[hide zhangqing]
[sfx footsteps]
[hide all]
[fx dark off]
[amb stop]
[bg sanceng_center fade]
[amb city]
[bgm sorrow]
[show naduo left]
[show xiahouying right]
出了楼门，风迎面一吹，我才发觉背上的衬衫已经湿了干、干了又湿，好几个来回。
夏侯婴早把长袖衬衫和水绿长裙穿了回去，满身的光符又藏得严严实实。
她把那卷东西收进包里，仰头看了看天，好像要确认自己真的回到了地面上。
[choice 临别之际——]
- “你的头痛……以后怎么办？” -> c10_bye_head
- “那本书，能借我翻两页吗？” -> c10_bye_book

== c10_bye_head
naduo: 你的头痛……以后怎么办？
xiahouying.sad: 老样子。疼起来就熬，熬过去，就算又赢了一回。
她说得云淡风轻。可我忘不了飞机上，她那张一丝血色都没有的脸。
[jump c10_bye_merge]

== c10_bye_book
naduo.smile: 那本书，能不能借我翻两页？就两页。
xiahouying.smile: 行啊。翻完第二页，你就该去医院挂神经内科了。
naduo.shock: ……那还是算了。
玩笑归玩笑，她这句话倒提醒了我：这门学问的代价，是记在她自己脑袋里的。
[jump c10_bye_merge]

== c10_bye_merge
naduo.serious: 曹操挨的那一刀是失败了。可那是快一千八百年前的手术台。
naduo: 如今的医生在人脑袋里能做的事，华佗做梦都想不到。那时候办不成的，现在未必办不成。
xiahouying.sad: ……真到了那一天，只要还有一线指望，我大概什么都肯试。
她笑了一下，笑里带着苦。
xiahouying.smile: 那多，后会有期。
[hide xiahouying]
[sfx footsteps]
她转身朝路口走去，步子又轻又快。等我回过神，人已经不见了，像一阵风刚刚吹过去。
[hide all]
[amb stop]
[bg sanceng_stairs fade]
[date 数日后 · 中央“三层楼” 二楼]
几天以后，我上二楼去敲那扇朱红色的门。敲了好一阵，没人应。
[show laotai right]
laotai: 寻老张头啊？走了呀。前天一早拎了只旧皮包出门，到今朝也没回来。
laotai.think: 门倒没锁。侬自己看好了。
[hide laotai]
[sfx door_open]
[bg zhang_room fade]
家具都还在，从墓里带出来的那几样东西，却一件也不剩。没留字条，没留去处。
可我猜得到他去干什么。沉寂了六十七年，地下世界的那位“王”，又要出山了。
——也不知道下一个遭殃的，是哪位帝王将相的长眠之地。

[if took_bronze -> c10_study]
[if chose_nothing -> c10_nostudy]
[jump c10_study]

== c10_study
[bg nado_study fade]
[date 2004年7月 · 家中]
[bgm truth]
[cg cg_bronze]
那套青铜酒器，我就摆在书橱里，夹在一排排书脊中间。
朋友来家里，顶多瞄上一眼，夸一句“这仿古货做得挺像”。没人会往深里想，这壶把儿上捂过的是谁的手。
盯着它们出神的时候，我常冒出个念头：当年青梅煮酒，曹操跟刘备对坐论英雄，斟酒用的会不会就是这一套？
[jump c10_liubei]

== c10_nostudy
[bg nado_home fade]
[date 2004年7月 · 家中]
[bgm truth]
我的书橱还是老样子，书挤着书，一格也没空出来。
偶尔也会想起卫不回那盏黄玉酒壶。当年青梅煮酒，曹操跟刘备对坐论英雄，斟酒用的会不会就是它？
[jump c10_liubei]

== c10_liubei
要真是那样，刘备可就太了不起了。
坐在他对面的，是把暗示之术玩到登峰造极的祖师爷。换了旁人，早被看得心悦诚服、纳头便拜。
刘备却稳稳地坐着，面不改色。
难怪曹操要叹一句“数天下英雄，惟使君与操耳”。这话里，怕是三分佩服，七分忌惮。
[cg off]

[hide all]
[bg sanceng_center fade]
[date 2004年7月9日 周五 · 普济路]
[bgm stop]
[amb city]
[show naduo center]
一个星期后，我在附近做完一个采访。回程时，两条腿不知怎么就拐上了普济路。
等回过神来，我已经推开了中央“三层楼”那扇沉甸甸的楼门。
[hide naduo]
[amb stop]
[bg sealed_stairs cut]
[bgm mystery]
[show naduo center shock]
[shake]
一楼最暗的那个角落里，通往地下室的楼梯，没了。
原先的楼梯口，被一整片水泥抹得平平展展，灰白、冰凉，就好像这儿从来只是一块地。
[sfx thud]
我蹲下去敲了敲。闷的，实的。钱六的小屋、书橱底下的洞、那条走不到头的甬道，全被压在了下面。
[sfx phone_ring]
手机偏偏在这时响了。屏幕上跳着三个字：梁应物。
[phone liangyingwu]
liangyingwu: 那多……你已经看到那段楼梯了吧？
naduo.angry: ……果然是你们。
liangyingwu: 这回……我得跟你说声对不起。
liangyingwu: 你本来就是机构名单上挂了号的人。这次托我办尼泊尔签证，走的是机构的门路——他们就顺手查了查，你急着出国干什么。
liangyingwu: 偏偏你做事从来不遮不掩。一根线头扯出一大串，没几天，前因后果他们摸得比我还清楚。
liangyingwu.serious: 你们从墓里出来第五天，地下室就封了。去下面的路另开了一条，不再经过这栋楼。
liangyingwu: 消息不是我漏的。可签证经的是我的手，这份责任，我推不掉。
我攥着手机，半天没吭声。说不恼是假的，可冲他发火也不讲理——换了我是X机构，这么大一块肥肉，也不会放着不咬。
naduo.serious: 算了。既然你们要下去，有件事，你最好转告带队的人。
naduo: 拱门后面还有四间墓室，连起来是个“心”字。恐惧、沮丧、愤怒、疯狂，一间比一间要命，有的屋里还藏着箭阵。别让人闷着头往里闯。
liangyingwu: ……记下了。谢谢。
他们迟早要下去。与其等着出人命，不如我把丑话说在前头——这个人情，就当送给老同学。
naduo: 晚上来我家一趟。有几样东西，放我这儿，不如放你们那儿。
[phone off]

[hide all]
[bg nado_home fade]
[date 同日 夜 · 家中]
[bgm truth]
[show naduo left]
[show liangyingwu right]
当天晚上，梁应物就上了门。他还没来得及开口，东西已经被我推到了他面前。
[item remove i_half_flag]
[item remove i_diary]
残旗叠得方方正正，那本被血粘住大半的本子封进了塑料袋。它们陪我做了半个多月的噩梦，今天总算有了去处。
[if chose_nothing -> c10_liang_photos]
至于那套青铜酒器，就大大方方搁在他背后的书橱里。他没多看一眼，我自然也没提。
[jump c10_liang_photos]

== c10_liang_photos
naduo.sad: 对了，还有一件。我给过钟老几张墓道的照片……就是那几张，要了他的命。
[hide all]
[bgm sorrow]
[flashback on]
[bg zhong_home fade]
[show zhongshutong center think]
那天早上的情形，我没亲眼见过。可一闭上眼，总能看见——
老人伏在书桌前，放大镜几乎贴上了相纸，烟缸里的烟头一根摞着一根。
他对着那些符号熬了几个钟头。后来，他搁下放大镜，站起身，一步一步朝窗口走了过去。
[sfx gust]
[hide zhongshutong]
[flashback off]
[bg nado_home fade]
[bgm mystery]
[show naduo left]
[show liangyingwu right serious]
naduo: 出事以后，警察把他桌上的东西都收走了。照片多半还在局里。
liangyingwu.serious: 我这就去要回来。
他走到阳台上，压低声音打了个电话。回来时推了推眼镜，像什么事都没发生过。
naduo: 底下那座墓，你们打算怎么处置？
liangyingwu: 那个项目不归我管。他们最后能不能琢磨透那些符号，我也未必能知道。
我心里咯噔一下：夏侯家守了几千年的不传之秘，别就这么流进了X机构的档案柜。
naduo.think: 我一直想不通。真有那种看一眼就叫人去寻死的符，曹操还打什么仗？
naduo: 谁碍眼，就修书一封，信纸上画一道——人家拆开一看，自己就去找绳子了。
naduo: 再不然，把它画到军旗上。吓人多费劲，直接让对面整支大军排队跳江，岂不省事？
liangyingwu.smile: 你这是替曹丞相想出了一统天下的捷径。
liangyingwu: 可惜行不通。叫人去死，是跟活物最底层的本能硬顶。人再糊涂，身子也会拼命往回拽。
liangyingwu: 要压过这股劲，非得有墓道那样的地方：四壁全是符，一步比一步浓，场强到了才管用。
naduo.sad: 那钟老……
liangyingwu.sad: 他九十多了，精力早不如从前，偏偏又一坐几个钟头，眼睛不离那些照片。最坏的几样，全让他赶上了。
liangyingwu: 再说回曹操。那时候的人日子苦，见惯了生死，心志比我们硬朗得多。能在乱世里拼出名堂的将相，更是一个比一个难撼动。
liangyingwu: 把这些人收拢到帐下，曹操已经使尽了浑身解数。至于周瑜、诸葛亮这样的对手——想让他们看一眼就去寻死？做梦。
naduo: 听你的意思，那会儿还有别人能跟他掰手腕？
liangyingwu.serious: 机构这些年摸到的情况是：科学越发达，那些没法用科学讲通的手艺，要么断了传承，要么换了身份藏起来。
liangyingwu: 三国那会儿可不一样。身怀绝技的人到处都是，夏侯家的暗示术，只是许多门秘术里的一门。曹操再强，也得提防着别人手里的牌。
我想起尼泊尔深山里那场“非人”的聚会，没有接话。
[sfx phone_buzz]
正说着，他的手机震了。离他在阳台上打那个电话，刚好两个钟头。
liangyingwu: 照片拿回来了，一张不少。放心，警察办案，不会对着几张怪图一看几个钟头。
[hide liangyingwu]
[sfx door_close]
那以后，这一类的话题，我们又断断续续聊过好多回。
[sfx pen]
[note 2004年7月9日，周五。\\n中央“三层楼”的地下室已被水泥封死，X机构接手。\\n旗和记录交给了应物，钟老的照片也追了回来。\\n书归夏侯婴，剑归卫不回。\\n——这件事，就记到这一页为止。]

[hide all]
[bg newsroom fade]
[date 2004年夏 · 晨星报编辑部]
[bgm daily]
[amb office]
[show naduo left tired]
日子总算回到了老样子。采访、写稿、赶版面，外加每天看领导的脸色。
碰上心里憋屈的时候，我就忍不住开始做白日梦。
那时候要是脸皮再厚一点，跟夏侯婴讨一道符回来，往电脑桌上一贴——
领导们路过瞄上一眼，心里便悄悄冒出一句：“那多这小子是块好料，该提拔了。”
第二天调令下来：部主任。再也不用顶着日头、淋着大雨满城追新闻。
或者更绝：请她把符描在一件白T恤上，我往身上一套，满街的姑娘瞧我一眼，就芳心暗许；我呢，挥挥手，一个也不带走……
naduo.smile: 嘿嘿……
[show lantou right serious]
lantou: 那多！一个人傻乐什么？下午的稿子呢？
naduo.shock: 来了来了，马上！
白日梦到此收场。至于那道符嘛——我到今天，也没好意思开口去求。
[hide all]
[amb stop]
[bg black slow]
[bgm truth]
[center 旗和记录进了X机构的柜子，书回到了夏侯家，那座墓换了一拨新的访客。\\n刻在石壁上的符，能用水泥封住；刻进人心里的，谁也封不住。]
[chapterend]
[ending te_xinshu]
`);
