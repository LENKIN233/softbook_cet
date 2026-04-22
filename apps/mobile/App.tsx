import React, { startTransition, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

type RouteKey = 'learning' | 'space' | 'statistics' | 'mine';
type DeviceClass = 'phone' | 'tablet';

type ShellRoute = {
  key: RouteKey;
  label: string;
  badge: string;
  eyebrow: string;
  title: string;
  summary: string;
  highlights: string[];
  focus: string[];
};

type Palette = {
  background: string;
  panel: string;
  panelStrong: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentStrong: string;
  tabIdle: string;
};

const ROUTES: ShellRoute[] = [
  {
    key: 'learning',
    label: '学习',
    badge: '01',
    eyebrow: '最重要入口',
    title: '单卡学习流',
    summary:
      '用低负担、单卡推进的方式进入备考主线，后续在业务分支接入真实卡片、分析层和交互效果。',
    highlights: [
      '保持单卡流而不是堆按钮和复杂状态。',
      '解释“这张卡为什么出现”，但不抢占答题主路径。',
      '当前壳层只验证入口结构，不实现登录门禁和学习算法。',
    ],
    focus: ['single-card-flow', 'core-interactions', 'auth gate'],
  },
  {
    key: 'space',
    label: '空间',
    badge: '02',
    eyebrow: '顶层入口',
    title: '知识地图与物理空间',
    summary:
      '空间不是收藏夹，也不是两个盒子的展示页。这里会承接 library / group / box / card 的层级和位置语义。',
    highlights: [
      '必须能看见卡片在空间中的位置。',
      '允许受控的收藏、休眠和位置调整，不允许任意改写知识归属。',
      '后续模块会补盒内浏览、位置反馈和知识层级展开。',
    ],
    focus: ['knowledge-map', 'box contents', 'sleep zone rules'],
  },
  {
    key: 'statistics',
    label: '统计',
    badge: '03',
    eyebrow: '服务核心价值',
    title: '轻量统计与签到',
    summary:
      '统计只用于增强信心和连续性，不成为产品中心。当前壳层只保留入口和信息位。',
    highlights: [
      '不把复杂计数器和状态机抬成核心体验。',
      '后续只补最小必要的签到、学习趋势和反馈摘要。',
      '页面会跟随设备形态变化，但入口顺序保持一致。',
    ],
    focus: ['basic check-in', 'light progress summary'],
  },
  {
    key: 'mine',
    label: '我的',
    badge: '04',
    eyebrow: '账户与会员',
    title: '个人页',
    summary:
      '这里承接账号、会员、恢复购买和设置等内容。当前阶段只保留入口骨架，后续再接短信登录和会员合同。',
    highlights: [
      '登录仍然是学习前置条件，但真实门禁在 auth 分支接入。',
      '会员、试用、恢复购买属于跨模块合同，不在壳层分支里展开。',
      '页面会作为 profile 和 paywall 的宿主，而不是散乱设置页。',
    ],
    focus: ['phone sms login', 'trial/paywall', 'purchase recovery'],
  },
];

const LIGHT_PALETTE: Palette = {
  background: '#F5F1E8',
  panel: '#FFFDF7',
  panelStrong: '#F0E6D3',
  border: '#D5C7B1',
  text: '#1F2421',
  textMuted: '#5F635D',
  accent: '#1E5B67',
  accentSoft: '#D9E9E6',
  accentStrong: '#123F49',
  tabIdle: '#7E766B',
};

const DARK_PALETTE: Palette = {
  background: '#121513',
  panel: '#1B201D',
  panelStrong: '#24312C',
  border: '#324139',
  text: '#F2F1EB',
  textMuted: '#B6BBB3',
  accent: '#8ED0C3',
  accentSoft: '#193C3C',
  accentStrong: '#B9E8DF',
  tabIdle: '#8A9389',
};

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const [activeRoute, setActiveRoute] = useState<RouteKey>('learning');
  const { width, height } = useWindowDimensions();
  const deviceClass = getDeviceClass(width, height);
  const route = ROUTES.find(item => item.key === activeRoute) ?? ROUTES[0];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      {deviceClass === 'tablet' ? (
        <TabletShell
          activeRoute={activeRoute}
          onSelectRoute={setActiveRoute}
          palette={palette}
          route={route}
        />
      ) : (
        <PhoneShell
          activeRoute={activeRoute}
          onSelectRoute={setActiveRoute}
          palette={palette}
          route={route}
        />
      )}
    </SafeAreaView>
  );
}

function PhoneShell({
  activeRoute,
  onSelectRoute,
  palette,
  route,
}: {
  activeRoute: RouteKey;
  onSelectRoute: (route: RouteKey) => void;
  palette: Palette;
  route: ShellRoute;
}) {
  return (
    <View style={styles.shellRoot}>
      <ShellHeader palette={palette} route={route} deviceClass="phone" />
      <RouteCanvas palette={palette} route={route} deviceClass="phone" />
      <View
        style={[
          styles.phoneTabBar,
          { backgroundColor: palette.panel, borderTopColor: palette.border },
        ]}>
        {ROUTES.map(item => {
          const isActive = item.key === activeRoute;
          const indicatorStyle = isActive
            ? { backgroundColor: palette.accent }
            : styles.phoneTabIndicatorHidden;

          return (
            <Pressable
              accessibilityRole="button"
              key={item.key}
              onPress={() => {
                startTransition(() => onSelectRoute(item.key));
              }}
              style={styles.phoneTabButton}>
              <Text
                style={[
                  styles.phoneTabBadge,
                  {
                    color: isActive ? palette.accentStrong : palette.tabIdle,
                  },
                ]}>
                {item.badge}
              </Text>
              <Text
                style={[
                  styles.phoneTabLabel,
                  { color: isActive ? palette.text : palette.tabIdle },
                ]}>
                {item.label}
              </Text>
              <View
                style={[
                  styles.phoneTabIndicator,
                  indicatorStyle,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabletShell({
  activeRoute,
  onSelectRoute,
  palette,
  route,
}: {
  activeRoute: RouteKey;
  onSelectRoute: (route: RouteKey) => void;
  palette: Palette;
  route: ShellRoute;
}) {
  return (
    <View style={styles.tabletRoot}>
      <View
        style={[
          styles.sidebar,
          { backgroundColor: palette.panel, borderRightColor: palette.border },
        ]}>
        <Text style={[styles.brandEyebrow, { color: palette.accent }]}>
          SHELL / IOS
        </Text>
        <Text style={[styles.brandTitle, { color: palette.text }]}>
          软书四六级
        </Text>
        <Text style={[styles.brandSummary, { color: palette.textMuted }]}>
          当前分支只打磨壳层导航，让 iPhone 与 iPad 都有明确的入口结构和信息重心。
        </Text>
        <View style={styles.sidebarNav}>
          {ROUTES.map(item => {
            const isActive = item.key === activeRoute;

            return (
              <Pressable
                accessibilityRole="button"
                key={item.key}
                onPress={() => {
                  startTransition(() => onSelectRoute(item.key));
                }}
                style={[
                  styles.sidebarItem,
                  {
                    backgroundColor: isActive
                      ? palette.accentSoft
                      : palette.panelStrong,
                    borderColor: isActive ? palette.accent : palette.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.sidebarBadge,
                    { color: isActive ? palette.accentStrong : palette.tabIdle },
                  ]}>
                  {item.badge}
                </Text>
                <View style={styles.sidebarCopy}>
                  <Text
                    style={[
                      styles.sidebarLabel,
                      { color: isActive ? palette.text : palette.textMuted },
                    ]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.sidebarEyebrow, { color: palette.tabIdle }]}>
                    {item.eyebrow}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.tabletContent}>
        <ShellHeader palette={palette} route={route} deviceClass="tablet" />
        <RouteCanvas palette={palette} route={route} deviceClass="tablet" />
      </View>
    </View>
  );
}

function ShellHeader({
  palette,
  route,
  deviceClass,
}: {
  palette: Palette;
  route: ShellRoute;
  deviceClass: DeviceClass;
}) {
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: palette.panel,
          borderBottomColor: palette.border,
        },
      ]}>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerEyebrow, { color: palette.accent }]}>
          {route.eyebrow}
        </Text>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          {route.label}
        </Text>
        <Text style={[styles.headerSummary, { color: palette.textMuted }]}>
          {deviceClass === 'phone'
            ? 'iPhone 使用底部导航；后续业务模块从这里接入。'
            : 'iPad 使用侧边导航；保持顶层顺序一致，但页面组成与手机不同。'}
        </Text>
      </View>
      <View
        style={[
          styles.headerPill,
          { backgroundColor: palette.accentSoft, borderColor: palette.border },
        ]}>
        <Text style={[styles.headerPillText, { color: palette.accentStrong }]}>
          {route.badge}
        </Text>
      </View>
    </View>
  );
}

function RouteCanvas({
  palette,
  route,
  deviceClass,
}: {
  palette: Palette;
  route: ShellRoute;
  deviceClass: DeviceClass;
}) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.canvasContent,
        deviceClass === 'tablet' ? styles.canvasContentTablet : null,
      ]}>
      <View
        style={[
          styles.hero,
          { backgroundColor: palette.panel, borderColor: palette.border },
        ]}>
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>
          当前阶段
        </Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>
          {route.title}
        </Text>
        <Text style={[styles.heroSummary, { color: palette.textMuted }]}>
          {route.summary}
        </Text>
      </View>

      <View style={styles.sectionGrid}>
        <InfoCard
          palette={palette}
          title="本分支只做什么"
          items={route.highlights}
        />
        <InfoCard
          palette={palette}
          title="下一步会接入"
          items={route.focus}
        />
        <InfoCard
          palette={palette}
          title="导航合同"
          items={[
            '顶层顺序固定为 学习 / 空间 / 统计 / 我的。',
            '学习保持最重要入口，空间保持顶层入口。',
            '壳层先跑通信息架构，不提前写会员、算法或卡片实现。',
          ]}
        />
        <InfoCard
          palette={palette}
          title="设备形态"
          items={
            deviceClass === 'phone'
              ? [
                  '当前布局面向 iPhone。',
                  '底部导航保持低操作成本。',
                  '后续业务屏会沿用这一层壳。',
                ]
              : [
                  '当前布局面向 iPad。',
                  '侧边导航允许同屏展示更多层级信息。',
                  '后续空间与统计模块会利用更宽的内容区。',
                ]
          }
        />
      </View>
    </ScrollView>
  );
}

function InfoCard({
  palette,
  title,
  items,
}: {
  palette: Palette;
  title: string;
  items: string[];
}) {
  return (
    <View
      style={[
        styles.infoCard,
        { backgroundColor: palette.panel, borderColor: palette.border },
      ]}>
      <Text style={[styles.infoTitle, { color: palette.text }]}>{title}</Text>
      {items.map(item => (
        <View key={item} style={styles.infoRow}>
          <View
            style={[
              styles.infoDot,
              { backgroundColor: palette.accent, borderColor: palette.border },
            ]}
          />
          <Text style={[styles.infoText, { color: palette.textMuted }]}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function getDeviceClass(width: number, height: number): DeviceClass {
  return Math.min(width, height) >= 768 ? 'tablet' : 'phone';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  shellRoot: {
    flex: 1,
  },
  tabletRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 300,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRightWidth: 1,
    gap: 18,
  },
  sidebarNav: {
    gap: 12,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sidebarBadge: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sidebarCopy: {
    flex: 1,
    gap: 4,
  },
  sidebarLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  sidebarEyebrow: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabletContent: {
    flex: 1,
  },
  brandEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  brandSummary: {
    fontSize: 15,
    lineHeight: 22,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
  },
  headerSummary: {
    fontSize: 14,
    lineHeight: 21,
  },
  headerPill: {
    minWidth: 56,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  headerPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  canvasContent: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  canvasContentTablet: {
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  heroSummary: {
    fontSize: 15,
    lineHeight: 23,
  },
  sectionGrid: {
    gap: 14,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 7,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  phoneTabBar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
  },
  phoneTabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
  },
  phoneTabBadge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  phoneTabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  phoneTabIndicator: {
    width: 24,
    height: 3,
    borderRadius: 999,
    marginTop: 4,
  },
  phoneTabIndicatorHidden: {
    backgroundColor: 'transparent',
  },
});

export default App;
