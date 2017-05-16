/* jshint ignore:start */
var $ = require('../lib/zepto.js');
var iScroll = require('../lib/iscroll');
var _ = require('../lib/underscore');
var dialogs = require('../util/dialogs');
var seatChooser = require('./modul/seatchooser');
var seatRender = require('./modul/seatrender');
var wxbridge = require('../util/wxbridge');
var Util = require('../util/widgets');
var cookie = require("../util/cookie.js");

/* jshint ignore:end */
$(document).ready(function() {
    window.dialogs = dialogs;
    var selected_seats;
    var openId = cookie.getItem('openids');
    function init(){
        initSeatControl();
        initSeatLine();
        localStorage.setItem('cinema', JSON.stringify(window.cinema));
        localStorage.setItem('showtime', JSON.stringify(window.showtime));
        localStorage.setItem('movie', JSON.stringify(window.movie));
    }

    function initSeatLine() {
        // 座位中线
        var $seatLine = $('.setline');

        // 座位图容器
        var $container = $('.smallticket');

        // 座位
        var $seats = $('.seat').not('.seat_null');
        var $firstSeat = $seats.first();
        var $lastSeat = $seats.last();
        var seatHeight = $seats.height();

        var containerOffset = $container.offset();
        var top = $firstSeat.offset().top - containerOffset.top - seatHeight;
        top = Math.max(0, top);

        var bottom = containerOffset.height - ($lastSeat.offset().top - containerOffset.top) - 2 * seatHeight;
        bottom = Math.max(0, bottom);

        $seatLine.css({
            top: top + 'px',
            bottom: bottom + 'px'
        });
    }

    function initSeatControl(){
        var $root = $('.wrap'),
            $room = $root.find('.room'),
            $table = $room.find('.ticket_seatcont');

        $room.css({
            height: document.documentElement.clientHeight - 210,
            width: '100%',
            overflow: 'hidden'
        });
        if($room){
            setTimeout(function () {
                seatRender.init({root: $root});
            }, 300)
        }
        setTimeout(function (){
            $room.css({
                visibility: 'visible'
            });
        }, 500)
        var chooserConfig = {
            root: $root,
            render: seatRender,
            //座位图容器
            seatContainer: $(".ticket_seatcont"),
            //最多选座个数
            limitCount: 4,
            //坐位3种状态
            selectSeatClassName: 'seat_selected',
            unSelectSeatClassName: 'seat_ture',
            selectedClassName: 'seat_false',
            selectedNullClassName: 'seat_null',
            //已选显示区容器及插入模板
            selectedContainer: '.seatinfo',
            selectedTemplaste: '<span></span>',
            //“选好了”提交按扭及两种状态
            submitBtn: $('.submit'),
            submitBtnClassName: 'submit',
            disableSubmitBtnClassName: 'notbtn',
            //选中时是否缩放
            isZoom: true,
            //选错提示语
            pointOutTxts: ['右侧座位不能为空', '左侧座位不能为空', '不能间隔选座（×）', '请不要留下单独座位（√）',
                '为避免留空，已为您关联取消了右侧座位（√）',
                '为避免留空，已为您关联取消了左侧座位（√）'],
            //回调返回已选拼装字符串 01:2:10|01:2:11
            callback: function (s_seats) {
                selected_seats = s_seats;
            }.bind(this)
        };
        seatChooser.initSeatChooser(chooserConfig);
        //处理座位点击
        var oldDate = new Date(), newDate;
        $table.on('tap', 'span', function (evt) {
            if ($(evt.currentTarget).hasClass('seat_selected') || $(evt.currentTarget).hasClass('seat_ture')) {

                newDate = new Date();
                if((newDate.getTime() - oldDate.getTime()) > 100){
                    oldDate = newDate;
                    console.log(1)
                    seatChooser.onTapSeat(evt);
                }
            }
        });//处理座位点击===============================================

        //选好座位提交
        $('.submit').on('click', function(evt){
            var _el = $(evt.currentTarget);
            var _len = selected_seats && selected_seats.length;
            var localTel = localStorage.getItem('tel') || '';
            dialogs.confirm('<p class="telinput flexbox"><input id="tel" type="tel" placeholder="请在这里输入手机号：" class="flex" value="'+localTel+'"></p>',
                function(){
                    var inputTel = $('#tel'),
                        tel = inputTel.val();
                    if(/^1[23456789]\d{9}$/.test(tel)){
                        localStorage.setItem('tel', tel);
                        // 设置 Cookie
                        var cookieExpired = 60 * 60 * 24 * 30; //30天
                        var cookiePath = '/';
                        cookie.setItem('tel', tel, cookieExpired, cookiePath);
                        if(_len){
                            lockSeats(selected_seats, _len, tel);
                        }
                    }else{
                        dialogs.tip('手机号不正确，请再试');
                    }
                }
            )


        })

        //锁座
        function lockSeats(selected_seats, _len, tel){
            var option    = {},
                seatIDs   = [],
                seatNames = [],
                showtimeId = showtime.showtimeID || '';

            var cancle = dialogs.Loading2();
            for(var i = 0; i < _len; i++){
                var _item = selected_seats[i].split('@');
                seatIDs.push(_item[0]);
                seatNames.push(_item[1]);
            };
            
            option.seatIDs    = seatIDs.join(',');
            option.seatNames  = seatNames.join(',');
            option.showtimeID = showtimeId;
            option.mobile     = tel;
            option.wxchannelCode     = publicsignal;
            $.post('/lockseats/' + showtimeId, option, function(reture_data){
                if(reture_data && reture_data.data && reture_data.success){
                    localStorage.setItem('seats_' + showtimeId, JSON.stringify( selected_seats ));
                    localStorage.setItem('lockseats_' + showtimeId, JSON.stringify( reture_data.data ));
                    localStorage.setItem('wxChannel', publicsignal || '');
                    localStorage.setItem('orderId', reture_data.data.orderID || '0');
                    location.href = '/payment/order/';
                }else{
                    cancle(true);
                    dialogs.tip('服务器繁忙，请稍候再试');
                }
            })
        }
    }

    init();

    //分享
    var _shareInfo = shareInfo && shareInfo;
    if(!_shareInfo){
        _shareInfo = {};
    }
    wxbridge.share({
        title: _shareInfo.title ? _shareInfo.title : '想去 '+ cinema.cinemaName +' 看 '+ showtime.ticketStartTime +' 场《' + movie.movieNameCN +'》有空吗？-电影票友',
        timelineTitle: _shareInfo.timelineTitle ? _shareInfo.timelineTitle : '想去 '+ cinema.cinemaName +' 看 '+ showtime.ticketStartTime +' 场《' + movie.movieNameCN +'》有空吗？-电影票友',
        desc: _shareInfo.desc ? _shareInfo.title : '[电影票友]荐：' + movie.intro,
        link: window.location.href,
        imgUrl: _shareInfo.imgUrl ? _shareInfo.imgUrl : movie.movieImage,
        callback: function(shareobj){
            Util.shearCallback(publicsignal, openId, showtime.showtimeID, 7, shareobj, function(){
                console.log('分享成功，并发送服务器');
            })
            // location.href = 'http://weixin.qq.com/r/fEPm40XEi433KAGAbxb4';
        }
    })
}); //END of jquery documet.ready
