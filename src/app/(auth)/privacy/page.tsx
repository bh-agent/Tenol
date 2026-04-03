import { TopBar } from '@/components/layout/top-bar';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar title="개인정보 처리방침" backHref="/login" />

      <div className="px-4 py-6 pb-32 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-1">테놀 개인정보 처리방침</h1>
        <p className="text-sm text-muted-foreground mb-8">시행일: 2026년 4월 1일</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          <p>
            테놀(이하 &quot;서비스&quot;)은 「개인정보 보호법」에 따라 이용자의 개인정보를
            보호하고 이와 관련한 고충을 신속하게 처리하기 위하여 다음과 같이 개인정보
            처리방침을 수립하여 공개합니다.
          </p>

          {/* 1. 수집하는 개인정보 항목 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              1. 수집하는 개인정보 항목
            </h2>

            <h3 className="text-sm font-medium text-foreground mb-1.5">
              가. 소셜 로그인 시 자동 수집 항목
            </h3>
            <ul className="list-disc list-inside space-y-1 mb-4">
              <li>카카오 로그인: 닉네임, 프로필 사진</li>
              <li>Google 로그인: 닉네임, 프로필 사진, 이메일</li>
            </ul>

            <h3 className="text-sm font-medium text-foreground mb-1.5">
              나. 회원이 직접 입력하는 항목
            </h3>
            <ul className="list-disc list-inside space-y-1 mb-4">
              <li>실명, 성별, NTRP 수준</li>
              <li>활동 지역, 자기소개</li>
              <li>프로필 사진 (변경 시)</li>
            </ul>

            <h3 className="text-sm font-medium text-foreground mb-1.5">
              다. 서비스 이용 과정에서 자동 생성되는 정보
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>경기 참가 기록, 경기 결과, 통계 데이터</li>
              <li>클럽 가입 및 활동 내역</li>
              <li>서비스 접속 일시, 접속 기기 정보</li>
            </ul>
          </section>

          {/* 2. 개인정보 수집 목적 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              2. 개인정보 수집 및 이용 목적
            </h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>회원 식별 및 가입 의사 확인, 본인 인증</li>
              <li>클럽 회원 관리 및 회원 간 식별</li>
              <li>경기 매칭, 결과 기록, 통계 산출</li>
              <li>서비스 개선 및 신규 기능 개발</li>
              <li>서비스 관련 공지사항 전달</li>
              <li>부정 이용 방지 및 서비스 안정성 확보</li>
            </ul>
          </section>

          {/* 3. 개인정보 보유기간 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              3. 개인정보의 보유 및 이용 기간
            </h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>
                회원 탈퇴 시까지 보유하며, 탈퇴 즉시 개인정보를 지체 없이 파기합니다.
              </li>
              <li>
                단, 관련 법령에 의한 보존 의무가 있는 경우 해당 기간 동안 보관합니다.
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>전자상거래 등에서의 소비자 보호에 관한 법률에 따른 계약 또는 청약
                    철회 등에 관한 기록: 5년</li>
                  <li>통신비밀보호법에 따른 로그인 기록: 3개월</li>
                </ul>
              </li>
            </ul>
          </section>

          {/* 4. 제3자 제공 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              4. 개인정보의 제3자 제공
            </h2>
            <p>
              서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의
              경우에는 예외로 합니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5 mt-2">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라
                수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          {/* 5. 처리위탁 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              5. 개인정보 처리위탁
            </h2>
            <p className="mb-3">
              서비스는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를
              위탁하고 있습니다.
            </p>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-card">
                    <th className="px-3 py-2 text-left font-medium text-foreground">수탁업체</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground">위탁 업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="px-3 py-2">Supabase Inc.</td>
                    <td className="px-3 py-2">클라우드 인프라 운영 및 데이터 저장</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Vercel Inc.</td>
                    <td className="px-3 py-2">웹 애플리케이션 호스팅</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. 이용자의 권리 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              6. 이용자의 권리와 행사 방법
            </h2>
            <p className="mb-2">
              이용자는 언제든지 다음의 권리를 행사할 수 있습니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>
                <span className="font-medium text-foreground">개인정보 열람 요구:</span>{' '}
                프로필 페이지에서 본인의 개인정보를 확인할 수 있습니다.
              </li>
              <li>
                <span className="font-medium text-foreground">개인정보 수정:</span>{' '}
                프로필 편집 기능을 통해 직접 수정할 수 있습니다.
              </li>
              <li>
                <span className="font-medium text-foreground">개인정보 삭제:</span>{' '}
                프로필 편집에서 선택 항목의 정보를 삭제할 수 있습니다.
              </li>
              <li>
                <span className="font-medium text-foreground">계정 탈퇴:</span>{' '}
                설정 메뉴의 계정 탈퇴 기능을 통해 회원 탈퇴 및 개인정보 삭제를 요청할 수
                있습니다. 탈퇴 시 모든 개인정보는 지체 없이 파기됩니다.
              </li>
            </ul>
          </section>

          {/* 7. 개인정보 안전성 확보 조치 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              7. 개인정보의 안전성 확보 조치
            </h2>
            <p className="mb-2">
              서비스는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>데이터 전송 시 SSL/TLS 암호화 적용</li>
              <li>비밀번호 등 중요 데이터의 암호화 저장</li>
              <li>개인정보 접근 권한 최소화</li>
              <li>정기적 보안 점검 실시</li>
            </ul>
          </section>

          {/* 8. 개인정보 보호책임자 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              8. 개인정보 보호책임자
            </h2>
            <p className="mb-2">
              서비스는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 이용자의 개인정보
              관련 불만 처리 및 피해 구제를 위하여 아래와 같이 개인정보 보호책임자를
              지정하고 있습니다.
            </p>
            <div className="rounded-lg border border-border/50 bg-card p-4 space-y-1">
              <p><span className="font-medium text-foreground">담당:</span> 테놀 운영팀</p>
              <p><span className="font-medium text-foreground">이메일:</span> tenol.app@gmail.com</p>
            </div>
          </section>

          {/* 9. 권익침해 구제 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              9. 권익침해 구제 방법
            </h2>
            <p className="mb-2">
              이용자는 개인정보 침해로 인한 피해 구제를 위해 다음 기관에 상담을 신청할 수
              있습니다.
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>개인정보침해 신고센터 (privacy.kisa.or.kr / 국번없이 118)</li>
              <li>개인정보 분쟁조정위원회 (www.kopico.go.kr / 1833-6972)</li>
              <li>대검찰청 사이버수사과 (www.spo.go.kr / 국번없이 1301)</li>
              <li>경찰청 사이버수사국 (ecrm.police.go.kr / 국번없이 182)</li>
            </ul>
          </section>

          {/* 10. 시행일 */}
          <section className="pt-4 border-t border-border/50">
            <h2 className="text-base font-semibold text-foreground mb-2">
              10. 개인정보 처리방침 변경
            </h2>
            <p>
              이 개인정보 처리방침은 2026년 4월 1일부터 적용됩니다. 변경 사항이 있을 경우
              서비스 내 공지를 통해 안내하겠습니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
