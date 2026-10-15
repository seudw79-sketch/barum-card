/* 바름클린 견적 계산기 — 가격은 /prices.json 단일 원본(build_prices.py 생성). 없는 가격은 지어내지 않고 사진 견적으로 보낸다. */
(function () {
  var TEL = "010-3427-5636", KAKAO_URL = ""; /* 카카오 채널 URL 확보 시 여기에만 넣으면 카톡 버튼이 나타난다 */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var won = function (n) { return n.toLocaleString("ko-KR") + "원"; };
  var P, box = $("#calc"), state = { tab: (box && box.dataset.tab) || "regular" };
  if (!box) return;
  document.querySelectorAll(".kakao").forEach(function (a) { if (KAKAO_URL) { a.href = KAKAO_URL; a.hidden = false; } else a.hidden = true; });
  function sms(text) { return "sms:" + TEL + "?&body=" + encodeURIComponent(text); }
  function setCta(msg) { document.querySelectorAll("[data-sms]").forEach(function (a) { a.href = sms(msg); }); }
  var TABS = [["regular", "정기청소"], ["room", "원룸청소"], ["aircon", "에어컨청소"], ["window", "외창청소"], ["repair", "작은집수리"]];

  function render() {
    var t = state.tab, h = box.dataset.single ? "" : '<div class="tabs" role="tablist">' + TABS.map(function (x) {
      return '<button type="button" role="tab" data-tab="' + x[0] + '" aria-selected="' + (x[0] === t) + '">' + x[1] + "</button>"; }).join("") + "</div>";
    h += '<div class="pane" id="pane"></div><div class="result" id="result" aria-live="polite"></div>';
    box.innerHTML = h;
    box.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { state.tab = b.dataset.tab; render(); }; });
    var pane = $("#pane");
    ({ regular: regular, room: room, aircon: aircon, window: win, repair: repair })[t](pane);
  }
  function out(price, lines, ask, tail) {
    var msg = "[바름클린 견적 문의] " + lines.join(" / ") + (price ? " (예상 " + won(price) + ")" : "") + (ask ? " 사진 보내겠습니다." : "") + (tail || "");
    $("#result").innerHTML = (price ? '<div class="big">' + won(price) + (tail ? "" : "") + '</div>' : '<div class="big ask">사진 보내 주시면 바로 견적</div>') +
      '<div class="small">' + lines.join(" · ") + '</div><div class="small">' + (price ? "예상 금액입니다. 오염·구조에 따라 현장에서 달라질 수 있습니다." : "사진과 주소를 문자로 보내 주시면 바로 견적을 드립니다.") + "</div>";
    setCta(msg);
  }
  function sel(id, label, opts) { return '<label class="f">' + label + '<select id="' + id + '">' + opts.map(function (o, i) { return '<option value="' + i + '">' + o + "</option>"; }).join("") + "</select></label>"; }

  function regular(p) {
    p.innerHTML = sel("rg_f", "방문 횟수", ["주 1회", "주 2회", "주 3회 이상", "한 달 2~3회"]) +
      '<label class="f">면적(평)<input id="rg_s" type="number" inputmode="numeric" min="1" placeholder="예: 30"></label>';
    var u = function () {
      var f = $("#rg_f").selectedOptions[0].text, s = $("#rg_s").value;
      $("#result").innerHTML = '<div class="big">월 ' + won(P.regular_from) + '부터</div><div class="small">' + f + (s ? " · " + s + "평" : "") +
        '</div><div class="small">면적·횟수에 따라 정해집니다. 사진이나 주소를 보내 주시면 견적을 드립니다.</div>';
      setCta("[바름클린 견적 문의] 사무실 정기청소 / " + f + (s ? " / " + s + "평" : "") + " 견적 부탁드립니다. 사진 보내겠습니다.");
    };
    p.oninput = u; u();
  }
  function room(p) {
    var sizes = [], kinds = [];
    P.rooms.forEach(function (r) { if (sizes.indexOf(r.size) < 0) sizes.push(r.size); if (kinds.indexOf(r.kind) < 0) kinds.push(r.kind); });
    p.innerHTML = sel("rm_s", "평수(분양평수)", sizes) + sel("rm_k", "형태", kinds) +
      '<label class="chk"><input type="checkbox" id="rm_b"> 베란다 추가 (+' + won(P.balcony) + ")</label>";
    var u = function () {
      var s = sizes[$("#rm_s").value], k = kinds[$("#rm_k").value], b = $("#rm_b").checked, r = P.rooms.filter(function (x) { return x.size === s && x.kind === k; })[0];
      out(r.price + (b ? P.balcony : 0), ["원룸 " + s, k, b ? "베란다 추가" : "베란다 없음"]);
    };
    p.oninput = u; p.onchange = u; u();
  }
  function aircon(p) {
    p.innerHTML = P.aircon.map(function (a, i) {
      return '<div class="row"><span>' + a.label + ' <small>' + won(a.price) + '</small></span><span class="qty"><button type="button" data-d="-1" data-i="' + i + '" aria-label="줄이기">−</button><b id="q' + i + '">0</b><button type="button" data-d="1" data-i="' + i + '" aria-label="늘리기">+</button></span></div>'; }).join("") +
      '<label class="chk"><input type="checkbox" id="ac_o"> 시스템 4way · 2in1 · 그 밖의 종류가 있어요</label>';
    var q = P.aircon.map(function () { return 0; });
    var u = function () {
      var tot = 0, ls = [];
      q.forEach(function (n, i) { $("#q" + i).textContent = n; if (n) { tot += n * P.aircon[i].price; ls.push(P.aircon[i].label + " " + n + "대"); } });
      var o = $("#ac_o").checked;
      if (o) ls.push("그 밖의 종류(시스템 4way·2in1 등)");
      if (!ls.length) { $("#result").innerHTML = '<div class="small">대수를 눌러 주세요.</div>'; setCta("[바름클린 견적 문의] 에어컨 청소 견적 부탁드립니다. 사진 보내겠습니다."); return; }
      if (o) { $("#result").innerHTML = (tot ? '<div class="big">' + won(tot) + ' + 별도 견적</div>' : '<div class="big ask">사진 보내 주시면 바로 견적</div>') +
        '<div class="small">' + ls.join(" · ") + '</div><div class="small">표에 없는 종류는 기종 사진을 보내 주시면 바로 견적을 드립니다.</div>';
        setCta("[바름클린 견적 문의] 에어컨 청소 / " + ls.join(", ") + (tot ? " (표 기준 " + won(tot) + " + 별도)" : "") + " 사진 보내겠습니다."); }
      else out(tot, ["에어컨 분해청소"].concat(ls));
    };
    p.onclick = function (e) { var b = e.target.closest("[data-d]"); if (!b) return; var i = +b.dataset.i; q[i] = Math.max(0, Math.min(20, q[i] + +b.dataset.d)); u(); };
    p.onchange = u; u();
  }
  function win(p) {
    p.innerHTML = sel("w_w", "어디 창인가요", ["가게 1층 유리", "가게 2층 유리", "아파트·집 창 바깥", "그 밖의 창"]) +
      '<label class="f">창 개수·크기 (아는 만큼)<input id="w_n" type="text" placeholder="예: 큰 유리 3장"></label>';
    var u = function () {
      var w = $("#w_w").selectedOptions[0].text, n = $("#w_n").value;
      out(null, ["외창 청소", w].concat(n ? [n] : []), true);
      setCta("[바름클린 견적 문의] 외창 청소 / " + w + (n ? " / " + n : "") + " 사진 보내겠습니다.");
    };
    p.oninput = u; p.onchange = u; u();
  }
  function repair(p) {
    var h = '<p class="small" style="margin:0 0 8px">필요한 것을 눌러 주세요. 제품비와 기본 시공비가 포함된 기준 가격입니다.</p>';
    P.repair.forEach(function (s, si) {
      h += '<details' + (si === 0 ? " open" : "") + "><summary>" + s.section + "</summary>" + s.items.map(function (it, ii) {
        return '<label class="chk"><input type="checkbox" data-s="' + si + '" data-i="' + ii + '"> <span>' + it.label + (it.note ? ' <small class="nt">' + it.note + "</small>" : "") + "</span><em>" + won(it.price) + "</em></label>"; }).join("") + "</details>";
    });
    p.innerHTML = h;
    var u = function () {
      var tot = 0, ls = [];
      p.querySelectorAll("input:checked").forEach(function (c) { var it = P.repair[+c.dataset.s].items[+c.dataset.i]; tot += it.price; ls.push(it.label); });
      if (!ls.length) { $("#result").innerHTML = '<div class="small">필요한 항목을 고르면 합계가 나옵니다. 표에 없는 수리는 사진을 보내 주세요.</div>'; setCta("[바름클린 견적 문의] 작은 집수리 문의드립니다. 사진 보내겠습니다."); return; }
      out(tot, ["작은집수리 " + ls.length + "건"].concat(ls));
    };
    p.onchange = u; u();
  }
  fetch("/prices.json").then(function (r) { return r.json(); }).then(function (j) { P = j; render(); }).catch(function () { box.innerHTML = '<p class="small">견적 계산기를 불러오지 못했습니다. 전화 또는 문자로 문의해 주세요.</p>'; });
})();
