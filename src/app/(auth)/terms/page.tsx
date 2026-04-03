import { TopBar } from '@/components/layout/top-bar';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar title="이용약관" backHref="/login" />

      <div className="px-4 py-6 pb-32 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-1">테놀 이용약관</h1>
        <p className="text-sm text-muted-foreground mb-8">시행일: 2026년 4월 1일</p>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
          {/* 제1조 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">제1조 (목적)</h2>
            <p>
              이 약관은 테놀(이하 &quot;서비스&quot;)이 제공하는 테니스 클럽 운영 관리 서비스의
              이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임 사항, 기타 필요한
              사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">제2조 (정의)</h2>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                &quot;서비스&quot;란 테놀이 제공하는 테니스 클럽 운영 관리 관련 제반 서비스를
                의미합니다.
              </li>
              <li>
                &quot;회원&quot;이란 본 약관에 동의하고 서비스에 가입하여 이용하는 자를
                의미합니다.
              </li>
              <li>
                &quot;클럽&quot;이란 서비스 내에서 회원이 생성하거나 가입한 테니스 클럽 단위를
                의미합니다.
              </li>
              <li>
                &quot;게시물&quot;이란 회원이 서비스 이용 시 작성한 텍스트, 사진, 경기 기록 등
                일체의 정보를 의미합니다.
              </li>
            </ol>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써
                효력이 발생합니다.
              </li>
              <li>
                서비스는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수
                있으며, 변경된 약관은 적용일자 7일 전부터 공지합니다.
              </li>
              <li>
                회원이 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수
                있습니다.
              </li>
            </ol>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">제4조 (서비스 내용)</h2>
            <p className="mb-2">서비스는 다음과 같은 기능을 제공합니다.</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>테니스 클럽 생성 및 관리</li>
              <li>클럽 회원 관리 및 권한 설정</li>
              <li>경기 일정 생성 및 참가 신청</li>
              <li>경기 결과 기록 및 통계 관리</li>
              <li>클럽 게시판 및 공지사항</li>
              <li>회원 프로필 및 NTRP 관리</li>
              <li>기타 테니스 클럽 운영에 필요한 부가 기능</li>
            </ul>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">제5조 (회원 가입)</h2>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                회원 가입은 카카오 또는 Google 계정을 통한 소셜 로그인 방식으로 이루어집니다.
              </li>
              <li>
                이용자는 본 약관 및 개인정보 처리방침에 동의한 후 회원 가입을 신청하며,
                서비스가 이를 승낙함으로써 회원 가입이 완료됩니다.
              </li>
              <li>
                회원은 가입 시 제공한 정보가 사실과 일치하도록 유지해야 하며, 변경 사항이
                있을 경우 즉시 수정해야 합니다.
              </li>
            </ol>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">제6조 (회원의 의무)</h2>
            <p className="mb-2">회원은 다음 행위를 하여서는 안 됩니다.</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>타인의 개인정보를 도용하거나 허위 정보를 등록하는 행위</li>
              <li>서비스의 정상적인 운영을 방해하는 행위</li>
              <li>다른 회원에 대한 욕설, 비방, 차별, 괴롭힘 등 부적절한 행위</li>
              <li>영리 목적의 광고, 스팸, 홍보 활동</li>
              <li>서비스를 통해 얻은 정보를 무단으로 수집, 이용, 제공하는 행위</li>
              <li>관련 법령 및 본 약관을 위반하는 행위</li>
            </ul>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">제7조 (서비스 이용제한)</h2>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                서비스는 회원이 본 약관을 위반하거나 서비스의 정상적인 운영을 방해하는 경우,
                사전 통지 후 서비스 이용을 제한하거나 회원 자격을 정지 또는 상실시킬 수
                있습니다.
              </li>
              <li>
                긴급한 경우 사전 통지 없이 즉시 이용을 제한할 수 있으며, 이후 사유를
                통보합니다.
              </li>
              <li>
                이용 제한에 이의가 있는 회원은 서비스에 이의 신청을 할 수 있으며, 서비스는
                합리적인 기간 내에 이를 검토하여 결과를 통보합니다.
              </li>
            </ol>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">제8조 (게시물 관리)</h2>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>회원이 작성한 게시물의 저작권은 해당 회원에게 귀속됩니다.</li>
              <li>
                서비스는 다음에 해당하는 게시물을 사전 통지 없이 삭제하거나 이동 또는
                등록을 거부할 수 있습니다.
                <ul className="list-disc list-inside ml-4 mt-1.5 space-y-1">
                  <li>다른 회원 또는 제3자를 비방하거나 명예를 훼손하는 내용</li>
                  <li>공공질서 및 미풍양속에 반하는 내용</li>
                  <li>범죄적 행위와 관련된 내용</li>
                  <li>기타 관련 법령에 위반되는 내용</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">제9조 (면책조항)</h2>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                서비스는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적인
                사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.
              </li>
              <li>
                서비스는 회원 간 또는 회원과 제3자 간에 서비스를 매개로 발생한 분쟁에 대해
                개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다.
              </li>
              <li>
                서비스는 무료로 제공되며, 서비스 이용과 관련하여 회원에게 발생한 손해에
                대해 서비스의 고의 또는 중과실이 없는 한 책임을 지지 않습니다.
              </li>
              <li>
                경기 결과, 통계, 랭킹 등의 데이터는 참고 목적으로 제공되며, 그 정확성을
                보장하지 않습니다.
              </li>
            </ol>
          </section>

          {/* 제10조 */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">제10조 (분쟁해결)</h2>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                서비스와 회원 간에 발생한 분쟁은 상호 협의하여 해결하는 것을 원칙으로
                합니다.
              </li>
              <li>
                본 약관에 명시되지 않은 사항은 대한민국 관련 법령 및 상관례에 따릅니다.
              </li>
              <li>
                분쟁이 발생하여 소송이 필요한 경우, 대한민국 법원을 관할 법원으로 합니다.
              </li>
            </ol>
          </section>

          {/* 부칙 */}
          <section className="pt-4 border-t border-border/50">
            <h2 className="text-base font-semibold text-foreground mb-2">부칙</h2>
            <p>본 약관은 2026년 4월 1일부터 시행합니다.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
