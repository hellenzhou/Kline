import { Control } from './control'
import { KlineTrade } from './kline_trade'
import { ChartManager } from './chart_manager'
import { ChartSettings } from './chart_settings'
import { Template } from './templates'
import { Range } from './ranges'
import '../css/main.css'
import tpl from '../view/tpl.html'
import fire from './firebase'
import $ from 'jquery'


export default class Kline {

    static created = false;
    static instance = null;

    constructor(option) {
        this.element = "#kline_container";
        this.chartMgr = null;
        this.G_HTTP_REQUEST = null;
        this.timer = null;
        this.buttonDown = false;
        this.init = false;
        this.requestParam = "";
        this.data = {};
        this.width = 1200;
        this.height = 650;
        this.symbol = "";
        this.symbolName = "";
        this.range = null;
        this.url = "";
        this.limit = 1000;
        this.type = "poll";
        this.subscribePath = "";
        this.sendPath = "";
        this.stompClient = null;
        this.intervalTime = 5000;
        this.debug = true;
        this.language = "zh-cn";
        this.theme = "dark";
        this.ranges = ["line", "1m", "1d", "5m", "15m", "30m", "1h", "4h", "12h", "1w"];
        this.showTrade = true;
        this.tradeWidth = 250;
        this.socketConnected = false;
        this.enableSockjs = true;
        this.reverseColor = false;
        this.isSized = false;
        this.paused = false;
        this.subscribed = null;
        this.disableFirebase = true;

        this.periodMap = {
            "01w": 7 * 86400 * 1000,
            "03d": 3 * 86400 * 1000,
            "01d": 86400 * 1000,
            "12h": 12 * 3600 * 1000,
            "06h": 6 * 3600 * 1000,
            "04h": 4 * 3600 * 1000,
            "02h": 2 * 3600 * 1000,
            "01h": 3600 * 1000,
            "30m": 30 * 60 * 1000,
            "15m": 15 * 60 * 1000,
            "05m": 5 * 60 * 1000,
            "03m": 3 * 60 * 1000,
            "01m": 60 * 1000,
            "line": 60 * 1000
        };

        this.tagMapPeriod = {
            "1w": "01w",
            "3d": "03d",
            "1d": "01d",
            "12h": "12h",
            "6h": "06h",
            "4h": "04h",
            "2h": "02h",
            "1h": "01h",
            "30m": "30m",
            "15m": "15m",
            "5m": "05m",
            "3m": "03m",
            "1m": "01m",
            "line": "line"
        };

        /*api文档  https://www.zb.com/i/developer/restApi#config */
        /*k线数据 参考文档type  since  size */
        this.klineBaseUrl = 'http://api.bitkk.com/data/v1/kline';
        this.klineMarketName = 'market';
        this.klineTypeName = 'type';
        this.klineSizeName = 'size';
        this.klineSinceName = 'since';
        this.klineSizeValue = '1000';

        this.klineSinceValue = null;
        this.G_KLINE_HTTP_REQUEST = null;
        this.klineData = {};
        this.klineTimer = null;
        this.klineIntervalTime = 3000;

        //行情数据
        this.tradesBaseUrl = 'http://api.bitkk.com/data/v1/trades';
        this.tradesMarketName = 'market';
        this.G_TRADES_HTTP_REQUEST = null;
        this.tradesData = {};
        this.tradesTimer = null;
        this.tradesIntervalTime = 8000;

        //市场深度数据
        this.depthBaseUrl = 'http://api.bitkk.com/data/v1/depth';
        this.depthMarketName = 'market';
        this.G_DEPTH_HTTP_REQUEST = null;
        this.depthData = {};
        this.depthTimer = null;
        this.depthIntervalTime = 8000;


        this.chatPeriodToolRanages = [];
        this.periodTitle = null;
        this.periodAreaRanages = null;
        this.deviceRatio = 2;
        this.bottomShowTrade = false;
        this.showLanguageSelect = false;
        this.showDrawTool = false;
        this.tradeHeight = 44;

        Object.assign(this, option);

        if (!Kline.created) {
            Kline.instance = this;
            Kline.created = true;
        }
        return Kline.instance;
    }


    /*********************************************
     * Methods
     *********************************************/
    periodsVertDisplayNone(array) {
        if (array && Array.isArray(array) && array.length > 0) {
            this.periodAreaRanages = array;
            for (let k in this.ranges) {
                let curPeriod = this.ranges[k];
                if (curPeriod && typeof (curPeriod) === "string" && array.indexOf(curPeriod) >= 0) {
                    let nodeName = '#chart_period_' + curPeriod + '_v';
                    $(nodeName).attr('style', "display:none");
                }
            }
        }
    }

    draw() {
        Kline.trade = new KlineTrade();
        Kline.chartMgr = new ChartManager();

        let view = $.parseHTML(tpl);
        for (let k in this.ranges) {
            let res = $(view).find('[name="' + this.ranges[k] + '"]');
            res.each(function (i, e) {
                $(e).attr("style", "display:inline-block");
            });
        }
        $(this.element).html(view);

        setInterval(Control.refreshFunction, this.intervalTime);
        if (this.type === "stomp") {
            Control.socketConnect();
        }

        if (!this.disableFirebase) {
            fire();
        }

        this.registerMouseEvent();
        ChartManager.instance.bindCanvas("main", document.getElementById("chart_mainCanvas"));
        ChartManager.instance.bindCanvas("overlay", document.getElementById("chart_overlayCanvas"));
        Control.refreshTemplate();
        Control.onSize(this.width, this.height);
        Control.readCookie();

        this.setTheme(this.theme);
        this.setLanguage(this.language);

        $(this.element).css({ visibility: "visible" });
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        Control.onSize(this.width, this.height);
    }

    setSymbol(symbol, symbolName) {
        this.symbol = symbol;
        this.symbolName = symbolName;
        Control.switchSymbol(symbol);
        this.onSymbolChange(symbol, symbolName);
    }

    setTheme(style) {
        this.theme = style;
        Control.switchTheme(style);
    }

    setLanguage(lang) {
        this.language = lang;
        Control.chartSwitchLanguage(lang);
    }

    setShowTrade(isShow) {
        this.showTrade = isShow;
        if (isShow) {
            $(".trade_container").show();
        } else {
            $(".trade_container").hide();
        }
        Control.onSize(this.width, this.height);
    }

    toggleTrade() {
        if (!this.showTrade) {
            this.showTrade = true;
            $(".trade_container").show();
        } else {
            this.showTrade = false;
            $(".trade_container").hide();
        }
        Control.onSize(this.width, this.height);
    }

    setIntervalTime(intervalTime) {
        this.intervalTime = intervalTime;
        if (this.debug) {
            console.log('DEBUG: interval time changed to ' + intervalTime);
        }
    }

    pause() {
        if (this.debug) {
            console.log('DEBUG: kline paused');
        }
        this.paused = true;
    }

    resend() {
        if (this.debug) {
            console.log('DEBUG: kline continue');
        }
        this.paused = false;
        Control.requestData(true);
    }

    connect() {
        if (this.type !== 'stomp') {
            if (this.debug) {
                console.log('DEBUG: this is for stomp type');
            }
            return;
        }
        Control.socketConnect();
    }

    disconnect() {
        if (this.type !== 'stomp') {
            if (this.debug) {
                console.log('DEBUG: this is for stomp type');
            }
            return;
        }
        if (this.stompClient) {
            this.stompClient.disconnect();
            this.socketConnected = false;
        }
        if (this.debug) {
            console.log('DEBUG: socket disconnected');
        }
    }


    /*********************************************
     * Events
     *********************************************/

    onResize(width, height) {
        if (this.debug) {
            console.log("DEBUG: chart resized to width: " + width + " height: " + height);
        }
    }

    onLangChange(lang) {
        if (this.debug) {
            console.log("DEBUG: language changed to " + lang);
        }
    }

    onSymbolChange(symbol, symbolName) {
        if (this.debug) {
            console.log("DEBUG: symbol changed to " + symbol + " " + symbolName);
        }
    }

    onThemeChange(theme) {
        if (this.debug) {
            console.log("DEBUG: themes changed to : " + theme);
        }
    }

    onRangeChange(range) {
        if (this.debug) {
            console.log("DEBUG: range changed to " + range);
        }
    }

    registerMouseEvent() {
        $(document).ready(function () {
            function __resize() {
                if (navigator.userAgent.indexOf('Firefox') >= 0) {
                    setTimeout(function () {
                        Control.onSize(this.width, this.height)
                    }, 200);
                } else {
                    Control.onSize(this.width, this.height)
                }
            }

            $('#chart_overlayCanvas').bind("contextmenu", function (e) {
                e.cancelBubble = true;
                e.returnValue = false;
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
            $(".chart_container .chart_dropdown .chart_dropdown_t")
                .mouseover(function () {
                    let container = $(".chart_container");
                    let title = $(this);
                    let dropdown = title.next();
                    let containerLeft = container.offset().left;
                    let titleLeft = title.offset().left;
                    let containerWidth = container.width();
                    let titleWidth = title.width();
                    let dropdownWidth = dropdown.width();
                    let d = ((dropdownWidth - titleWidth) / 2) << 0;
                    if (titleLeft - d < containerLeft + 4) {
                        d = titleLeft - containerLeft - 4;
                    } else if (titleLeft + titleWidth + d > containerLeft + containerWidth - 4) {
                        d += titleLeft + titleWidth + d - (containerLeft + containerWidth - 4) + 19;
                    } else {
                        d += 4;
                    }
                    dropdown.css({ "margin-left": -d });
                    title.addClass("chart_dropdown-hover");
                    dropdown.addClass("chart_dropdown-hover");
                })
                .mouseout(function () {
                    $(this).next().removeClass("chart_dropdown-hover");
                    $(this).removeClass("chart_dropdown-hover");
                });
            $(".chart_dropdown_data")
                .mouseover(function () {
                    $(this).addClass("chart_dropdown-hover");
                    $(this).prev().addClass("chart_dropdown-hover");
                })
                .mouseout(function () {
                    $(this).prev().removeClass("chart_dropdown-hover");
                    $(this).removeClass("chart_dropdown-hover");
                });
            $("#chart_btn_parameter_settings").click(function () {
                $('#chart_parameter_settings').addClass("clicked");
                $(".chart_dropdown_data").removeClass("chart_dropdown-hover");
                $("#chart_parameter_settings").find("th").each(function () {
                    let name = $(this).html();
                    let index = 0;
                    let tmp = ChartSettings.get();
                    let value = tmp.indics[name];
                    $(this.nextElementSibling).find("input").each(function () {
                        if (value !== null && index < value.length) {
                            $(this).val(value[index]);
                        }
                        index++;
                    });
                });
            });
            $("#close_settings").click(function () {
                $('#chart_parameter_settings').removeClass("clicked");
            });
            $(".chart_container .chart_toolbar_tabgroup a")
                .click(function () {
                    Control.switchPeriod($(this).parent().attr('name'));
                    // modify  add 
                    $(".chart_str_period").removeClass('selected');
                    if (Kline.instance.periodTitle && Kline.instance.periodTitle.length > 0) {
                        $(".chart_str_period").text(Kline.instance.periodTitle);
                    }

                });
            $("#chart_toolbar_periods_vert ul a").click(function () {

                Control.switchPeriod($(this).parent().attr('name'));
                // modify  add 
                let pdescribe = $(this).text();
                if (pdescribe != undefined && typeof (pdescribe) === "string") {
                    $(".chart_str_period").text(pdescribe);
                    $(".chart_str_period").addClass('selected');
                }

            });

            $(".market_chooser ul a").click(function () {
                Control.switchSymbol($(this).attr('name'));
            });

            $('#chart_show_tools')
                .click(function () {
                    if ($(this).hasClass('selected')) {
                        Control.switchTools('off');
                    } else {
                        Control.switchTools('on');
                    }
                });
            $("#chart_toolpanel .chart_toolpanel_button")
                .click(function () {
                    $(".chart_dropdown_data").removeClass("chart_dropdown-hover");
                    $("#chart_toolpanel .chart_toolpanel_button").removeClass("selected");
                    $(this).addClass("selected");
                    let name = $(this).children().attr('name');
                    Kline.instance.chartMgr.setRunningMode(ChartManager.DrawingTool[name]);
                });
            $('#chart_show_indicator')
                .click(function () {
                    if ($(this).hasClass('selected')) {
                        Control.switchIndic('off');
                    } else {
                        Control.switchIndic('on');
                    }
                });
            $("#chart_tabbar li a")
                .click(function () {
                    $("#chart_tabbar li a").removeClass('selected');
                    $(this).addClass('selected');
                    let name = $(this).attr('name');
                    let tmp = ChartSettings.get();
                    tmp.charts.indics[1] = name;
                    ChartSettings.save();
                    if (Template.displayVolume === false)
                        ChartManager.instance.getChart().setIndicator(1, name);
                    else
                        ChartManager.instance.getChart().setIndicator(2, name);
                });
            $("#chart_select_chart_style a")
                .click(function () {
                    $("#chart_select_chart_style a").removeClass('selected');
                    $(this).addClass("selected");
                    let tmp = ChartSettings.get();
                    tmp.charts.chartStyle = $(this)[0].innerHTML;
                    ChartSettings.save();
                    let mgr = ChartManager.instance;
                    mgr.setChartStyle("frame0.k0", $(this).html());
                    mgr.redraw();
                });
            $('#chart_dropdown_themes li').click(function () {
                $('#chart_dropdown_themes li a').removeClass('selected');
                let name = $(this).attr('name');
                if (name === 'chart_themes_dark') {
                    Control.switchTheme('dark');
                } else if (name === 'chart_themes_light') {
                    Control.switchTheme('light');
                }
            });
            $("#chart_select_main_indicator a")
                .click(function () {
                    $("#chart_select_main_indicator a").removeClass('selected');
                    $(this).addClass("selected");
                    let name = $(this).attr('name');
                    let tmp = ChartSettings.get();
                    tmp.charts.mIndic = name;
                    ChartSettings.save();
                    let mgr = ChartManager.instance;
                    if (!mgr.setMainIndicator("frame0.k0", name))
                        mgr.removeMainIndicator("frame0.k0");
                    mgr.redraw();
                });
            $('#chart_toolbar_theme a').click(function () {
                $('#chart_toolbar_theme a').removeClass('selected');
                if ($(this).attr('name') === 'dark') {
                    Control.switchTheme('dark');
                } else if ($(this).attr('name') === 'light') {
                    Control.switchTheme('light');
                }
            });
            $('#chart_select_theme li a').click(function () {
                $('#chart_select_theme a').removeClass('selected');
                if ($(this).attr('name') === 'dark') {
                    Control.switchTheme('dark');
                } else if ($(this).attr('name') === 'light') {
                    Control.switchTheme('light');
                }
            });
            $('#chart_enable_tools li a').click(function () {
                $('#chart_enable_tools a').removeClass('selected');
                if ($(this).attr('name') === 'on') {
                    Control.switchTools('on');
                } else if ($(this).attr('name') === 'off') {
                    Control.switchTools('off');
                }
            });
            $('#chart_enable_indicator li a').click(function () {
                $('#chart_enable_indicator a').removeClass('selected');
                if ($(this).attr('name') === 'on') {
                    Control.switchIndic('on');
                } else if ($(this).attr('name') === 'off') {
                    Control.switchIndic('off');
                }
            });
            $('#chart_language_setting_div li a').click(function () {

                $('#chart_language_setting_div a').removeClass('selected');
                if ($(this).attr('name') === 'zh-cn') {
                    Control.chartSwitchLanguage('zh-cn');
                } else if ($(this).attr('name') === 'en-us') {

                    Control.chartSwitchLanguage('en-us');
                } else if ($(this).attr('name') === 'zh-tw') {
                    Control.chartSwitchLanguage('zh-tw');
                }
            });
            $(document).keyup(function (e) {
                if (e.keyCode === 46) {
                    ChartManager.instance.deleteToolObject();
                    ChartManager.instance.redraw('OverlayCanvas', false);
                }
            });
            $("#clearCanvas").click(function () {
                let pDPTool = ChartManager.instance.getDataSource("frame0.k0");
                let len = pDPTool.getToolObjectCount();
                for (let i = 0; i < len; i++) {
                    pDPTool.delToolObject();
                }
                ChartManager.instance.redraw('OverlayCanvas', false);
            });

            // 支持移动mobile触摸屏
            let chart_overlayCanvas = document.getElementById('chart_overlayCanvas');
            chart_overlayCanvas.ontouchstart = function (e) {
                Kline.instance.buttonDown = true;
                let r = e.target.getBoundingClientRect();
                let x = e.touches[0].clientX - r.left;
                let y = e.touches[0].clientY - r.top;

                if (ChartManager.instance.getx() !== 0) {
                    // x'=xcosθ-ysinθ
                    // y'=xsinθ+ycosθ 
                    // 翻转回去 -90度
                    let realX = y - 768 / 2;
                    let realY = -x + 414 / 2;
                    x = realX;
                    y = realY;
                }

                console.log('ontouchstart x:' + x, 'y:' + y);
                ChartManager.instance.onMouseDown("frame0", x, y);
            }

            chart_overlayCanvas.ontouchmove = function (e) {
                let r = e.target.getBoundingClientRect();
                let x = e.changedTouches[0].clientX - r.left;
                let y = e.changedTouches[0].clientY - r.top;
                let mgr = ChartManager.instance;
                if (ChartManager.instance.getx() !== 0) {
                    let realX = y - 768 / 2;
                    let realY = -x + 414 / 2;
                    x = realX;
                    y = realY;
                }

                if (Kline.instance.buttonDown === true) {
                    mgr.onMouseMove("frame0", x, y, true);
                    mgr.redraw("All", false);
                } else {
                    mgr.onMouseMove("frame0", x, y, false);
                    mgr.redraw("OverlayCanvas");
                }
            }

            chart_overlayCanvas.ontouchend = function (e) {
                Kline.instance.buttonDown = false;
                let r = e.target.getBoundingClientRect();
                let x = e.changedTouches[0].clientX - r.left;
                let y = e.changedTouches[0].clientY - r.top;
                let mgr = ChartManager.instance;
                if (ChartManager.instance.getx() !== 0) {
                    let realX = y - Kline.instance.width / 2;
                    let realY = -x + Kline.instance.height / 2;
                    x = realX;
                    y = realY;
                }

                console.log('ontouchend x:' + x, 'y:' + y);
                mgr.onMouseUp("frame0", x, y);
                mgr.redraw("All");
            }

            chart_overlayCanvas.ontouchcancel = function (e) {
                let r = e.target.getBoundingClientRect();
                let x = e.clientX - r.left;
                let y = e.clientY - r.top;
                let mgr = ChartManager.instance;
                if (ChartManager.instance.getx() !== 0) {
                    let realX = y - Kline.instance.width / 2;
                    let realY = -x + Kline.instance.height / 2;
                    x = realX;
                    y = realY;
                }
                mgr.onMouseLeave("frame0", x, y, false);
                mgr.redraw("OverlayCanvas");
            }
            $("#chart_overlayCanvas")
                .mousemove(function (e) {

                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    let mgr = ChartManager.instance;
                    let ratio = Kline.instance.deviceRatio;
                    if (ChartManager.instance.getx() !== 0) {
                        let realX = y - Kline.instance.width / 2;
                        let realY = -x + Kline.instance.height / 2;
                        x = realX;
                        y = realY;
                    }

                    if (Kline.instance.buttonDown === true) {
                        mgr.onMouseMove("frame0", x * ratio, y * ratio, true);
                        mgr.redraw("All", false);
                    } else {
                        mgr.onMouseMove("frame0", x * ratio, y * ratio, false);
                        mgr.redraw("OverlayCanvas");
                    }

                    console.log('mousemove x:' + x, 'y:' + y);

                })
                .mouseleave(function (e) {
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    let mgr = ChartManager.instance;
                    let ratio = Kline.instance.deviceRatio;
                    if (ChartManager.instance.getx() !== 0) {
                        let realX = y - Kline.instance.width / 2;
                        let realY = -x + Kline.instance.height / 2;
                        x = realX;
                        y = realY;
                    }
                    mgr.onMouseLeave("frame0", x * ratio, y * ratio, false);
                    mgr.redraw("OverlayCanvas");
                    console.log('mouseleave x:' + x, 'y:' + y);
                })
                .mouseup(function (e) {
                    if (e.which !== 1) {
                        return;
                    }
                    Kline.instance.buttonDown = false;
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    if (ChartManager.instance.getx() !== 0) {
                        let realX = y - Kline.instance.width / 2;
                        let realY = -x + Kline.instance.height / 2;
                        x = realX;
                        y = realY;
                    }
                    let mgr = ChartManager.instance;
                    let ratio = Kline.instance.deviceRatio;
                    mgr.onMouseUp("frame0", x * ratio, y * ratio);
                    mgr.redraw("All");
                    console.log('mouseup x:' + x, 'y:' + y);
                })
                .mousedown(function (e) {
                    if (e.which !== 1) {
                        ChartManager.instance.deleteToolObject();
                        ChartManager.instance.redraw('OverlayCanvas', false);
                        return;
                    }

                    Kline.instance.buttonDown = true;
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    let ratio = Kline.instance.deviceRatio;
                    if (ChartManager.instance.getx() !== 0) {
                        let realX = y - Kline.instance.width / 2;
                        let realY = -x + Kline.instance.height / 2;
                        x = realX;
                        y = realY;
                    }

                    ChartManager.instance.onMouseDown("frame0", x * ratio, y * ratio);
                    console.log('mousedown x:' + x, 'y:' + y);
                });

            /*
            $("#chart_overlayCanvas")
                .mousemove(function (e) {
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    let mgr = ChartManager.instance;
                    if (Kline.instance.buttonDown === true) {
                        mgr.onMouseMove("frame0", x, y, true);
                        mgr.redraw("All", false);
                    } else {
                        mgr.onMouseMove("frame0", x, y, false);
                        mgr.redraw("OverlayCanvas");
                    }
                })
                .mouseleave(function (e) {
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    let mgr = ChartManager.instance;
                    mgr.onMouseLeave("frame0", x, y, false);
                    mgr.redraw("OverlayCanvas");
                })
                .mouseup(function (e) {
                    if (e.which !== 1) {
                        return;
                    }
                    Kline.instance.buttonDown = false;
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    let mgr = ChartManager.instance;
                    mgr.onMouseUp("frame0", x, y);
                    mgr.redraw("All");
                })
                .mousedown(function (e) {
                    if (e.which !== 1) {
                        ChartManager.instance.deleteToolObject();
                        ChartManager.instance.redraw('OverlayCanvas', false);
                        return;
                    }
                    Kline.instance.buttonDown = true;
                    let r = e.target.getBoundingClientRect();
                    let x = e.clientX - r.left;
                    let y = e.clientY - r.top;
                    ChartManager.instance.onMouseDown("frame0", x, y);
                });
           */
            $("#chart_parameter_settings :input").change(function () {
                let name = $(this).attr("name");
                let index = 0;
                let valueArray = [];
                let mgr = ChartManager.instance;
                $("#chart_parameter_settings :input").each(function () {
                    if ($(this).attr("name") === name) {
                        if ($(this).val() !== "" && $(this).val() !== null && $(this).val() !== undefined) {
                            let i = parseInt($(this).val());
                            valueArray.push(i);
                        }
                        index++;
                    }
                });
                if (valueArray.length !== 0) {
                    mgr.setIndicatorParameters(name, valueArray);
                    let value = mgr.getIndicatorParameters(name);
                    let cookieArray = [];
                    index = 0;
                    $("#chart_parameter_settings :input").each(function () {
                        if ($(this).attr("name") === name) {
                            if ($(this).val() !== "" && $(this).val() !== null && $(this).val() !== undefined) {
                                $(this).val(value[index].getValue());
                                cookieArray.push(value[index].getValue());
                            }
                            index++;
                        }
                    });
                    let tmp = ChartSettings.get();
                    tmp.indics[name] = cookieArray;
                    ChartSettings.save();
                    mgr.redraw('All', false);
                }
            });
            $("#chart_parameter_settings button").click(function () {
                let name = $(this).parents("tr").children("th").html();
                let index = 0;
                let value = ChartManager.instance.getIndicatorParameters(name);
                let valueArray = [];
                $(this).parent().prev().children('input').each(function () {
                    if (value !== null && index < value.length) {
                        $(this).val(value[index].getDefaultValue());
                        valueArray.push(value[index].getDefaultValue());
                    }
                    index++;
                });
                ChartManager.instance.setIndicatorParameters(name, valueArray);
                let tmp = ChartSettings.get();
                tmp.indics[name] = valueArray;
                ChartSettings.save();
                ChartManager.instance.redraw('All', false);
            });

            $("#kline_container").on('click', '#fullscreen_chart_updated_time', function () {
        
                Kline.instance.isSized = !Kline.instance.isSized;
                let chart_container_fullscreen = $('#chart_container_fullscreen');
                chart_container_fullscreen.css('display', "none");
                let chart_trade_quotation = $('.chart_trade_quotation');
                let chart_container = $('.chart_container');
                let trade_container = $('.trade_container');

                chart_trade_quotation.css('display', "block");
                chart_container = chart_container.detach();
                // chart_trade_quotation.after(chart_container);

                trade_container.css('display', "block");
                // let mainCanvas = $('#chart_mainCanvas')[0];
                // let overlayCanvas = $('#chart_overlayCanvas')[0];

                // let context = mainCanvas.getContext("2d");


                ChartManager.instance.setxy(0, 0);
                // context.setTransform(1, 0, 0, 1, 0, 0);
                // context.translate(0 , 0);
                // context.rotate(-90 * Math.PI / 180); 

                // let overlayerContext = overlayCanvas.getContext("2d"); 
                // Range.setLandscapeOffSetY(0);
                // overlayerContext.setTransform(1,0,0,1,0,0);
                // overlayerContext.translate(0 , 0);
                // overlayerContext.rotate(-90 * Math.PI / 180);     

                Range.setLandscapeOffsetY(-1);
                chart_trade_quotation.after(chart_container);
                Control.onSize(Kline.instance.width, Kline.instance.height);

            });
            $("#kline_container").on('click', '#sizeIcon', function () {
                Kline.instance.isSized = !Kline.instance.isSized;
                let chart_container_fullscreen = $('#chart_container_fullscreen');
                let chart_trade_quotation = $('.chart_trade_quotation');
                let chart_container = $('.chart_container');
                let trade_container = $('.trade_container');

                if (Kline.instance.isSized) {
                    trade_container.css('display', "none");
                    chart_container.appendTo(chart_container_fullscreen);
                    Control.onSize(Kline.instance.height, Kline.instance.width);
                    chart_container_fullscreen.css('display', "block");
                    chart_trade_quotation.css('display', "none");
                    debugger
                    Range.setLandscapeOffsetY(Kline.instance.height * Kline.instance.deviceRatio);
                } else {
                    chart_trade_quotation.css('display', "block");
                    chart_container = chart_container.detach();
                    chart_trade_quotation.after(chart_container);
                    chart_container_fullscreen.css('display', "none");
                    trade_container.css('display', "block");
                    Control.onSize(Kline.instance.width, Kline.instance.height);
                    Range.setLandscapeOffsetY(-1);
                }

                return;


                if (Kline.instance.isSized) {
                    $(Kline.instance.element).css({
                        position: 'fixed',
                        left: '0',
                        right: '0',
                        top: '0',
                        bottom: '0',
                        width: '100%',
                        height: '100%',
                        zIndex: '10000'
                    });

                    Control.onSize();
                    $('html,body').css({ width: '100%', height: '100%', overflow: 'hidden' });
                } else {
                    $(Kline.instance.element).attr('style', '');

                    $('html,body').attr('style', '');

                    Control.onSize(Kline.instance.width, Kline.instance.height);
                    $(Kline.instance.element).css({ visibility: 'visible', height: Kline.instance.height + 'px' });
                }
            });

            $("#kline_container").on('click', '#tabList li', function (element) {
                var currentTarget = $(element.currentTarget),
                    showTabContent = currentTarget.data().show;
                $("#" + showTabContent).show();
                $("#" + showTabContent).siblings("div").hide();
                currentTarget.addClass("current");
                currentTarget.siblings().removeClass("current");
            });
            // modify  add
            $("#chart_main_indicator li")
                .click(function () {
                    $("#chart_main_indicator a").removeClass('selected');
                    $(this).find('a').addClass("selected");
                    let name = $(this).find('a').attr('name');
                    let tmp = ChartSettings.get();
                    tmp.charts.mIndic = name;
                    ChartSettings.save();

                    let mgr = ChartManager.instance;
                    if (!mgr.setMainIndicator("frame0.k0", name))
                        mgr.removeMainIndicator("frame0.k0");
                    mgr.redraw();

                    $("#chart_main_indicator .chart_dropdown_data").removeClass("chart_dropdown-hover");
                    $("#chart_main_indicator .chart_dropdown_t").removeClass("chart_dropdown-hover");
                });

        })

    }

}