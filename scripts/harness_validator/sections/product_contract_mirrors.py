# Auth / trial / purchase owner: account-sync-contract.
check_equal(
    "login_required",
    auth["authentication"]["login_is_required_before_learning"],
    req["authentication_policy"]["login_is_required_before_learning"],
)
check_equal(
    "guest_learning_before_authentication",
    auth["authentication"]["guest_learning_before_authentication"],
    req["authentication_policy"]["guest_learning_before_authentication"],
)
check_equal(
    "primary_login_method requirement-memory",
    auth["authentication"]["primary_login_method"],
    req["authentication_policy"]["primary_login_method"],
)
check_equal(
    "primary_login_method platform-contract",
    auth["authentication"]["primary_login_method"],
    platform["authentication_policy"]["primary_login_method"],
)
check_equal(
    "trial_start requirement-memory",
    auth["trial_and_purchase"]["trial_starts_when"],
    req["business"]["trial_starts_when"],
)
check_equal(
    "trial_start membership",
    auth["trial_and_purchase"]["trial_starts_when"],
    membership["policy"]["trial_start_trigger"],
)
check_equal(
    "trial_start product-core",
    auth["trial_and_purchase"]["trial_starts_when"],
    product["monetization"]["trial_start_trigger"],
)
check_equal(
    "purchase_recovery requirement-memory",
    auth["trial_and_purchase"]["purchase_recovery_reminder"],
    req["business"]["purchase_recovery_reminder"],
)
check_equal(
    "purchase_recovery membership",
    auth["trial_and_purchase"]["purchase_recovery_reminder"],
    membership["policy"]["purchase_recovery_reminder"],
)
check_equal(
    "purchase_recovery platform-contract",
    auth["trial_and_purchase"]["purchase_recovery_reminder"],
    platform["commerce_surface_policy"]["purchase_recovery_reminder"],
)
check_equal(
    "purchase_recovery product-core",
    auth["trial_and_purchase"]["purchase_recovery_reminder"],
    product["monetization"]["post_membership_recovery_prompt"],
)
check_equal(
    "web_app_purchase_authority membership",
    auth["trial_and_purchase"]["web_and_app_purchase_authority"],
    membership["policy"]["web_and_app_purchase_authority"],
)
check_equal(
    "web_app_purchase_authority platform-contract",
    auth["trial_and_purchase"]["web_and_app_purchase_authority"],
    platform["commerce_surface_policy"]["web_and_app_purchase_authority"],
)


# Sync owner: account-sync-contract.
check_equal(
    "sync_targets requirement-memory",
    auth["sync_scope"]["must_sync"],
    req["cross_surface_continuity"]["sync_targets"],
)
check_equal(
    "sync_targets product-core",
    auth["sync_scope"]["must_sync"],
    product["multi_surface_strategy"]["continuity_model"]["sync_targets"],
)
check_equal(
    "sync_mode requirement-memory",
    auth["sync_scope"]["target_sync_mode"],
    req["cross_surface_continuity"]["target_sync_mode"],
)
check_equal(
    "sync_mode product-core",
    auth["sync_scope"]["target_sync_mode"],
    product["multi_surface_strategy"]["continuity_model"]["target_sync_mode"],
)


# Platform owner: platform-contract.
platform_release_targets = [
    key for key, enabled in platform["release_targets"].items() if enabled
]
check_equal(
    "release_targets requirement-memory",
    platform_release_targets,
    req["platform_requirements"]["release_targets"],
)
check_equal(
    "release_targets product-core.multi_surface_strategy",
    platform_release_targets,
    product["multi_surface_strategy"]["release_targets"],
)
check_equal(
    "release_targets product-core.technical_constraints",
    platform_release_targets,
    product["technical_constraints"]["release_targets"],
)
check_equal(
    "priority_order requirement-memory",
    platform["design_strategy"]["mobile_priority"],
    req["platform_requirements"]["priority_order"],
)
check_equal(
    "priority_order product-core",
    platform["design_strategy"]["mobile_priority"],
    product["multi_surface_strategy"]["priority_order"],
)
check_equal(
    "nav_order requirement-memory",
    platform["navigation_contract"]["order"],
    req["page_and_spec_needs"]["top_level_navigation_is_consistent_across_surfaces"],
)
check_equal(
    "nav_order product-core",
    platform["navigation_contract"]["order"],
    product["surface_navigation"]["consistent_top_level_nav_order"],
)
check_equal(
    "learning_entry_requirement-memory",
    platform["entry_priority_by_surface"]["learning_flow_is_most_important_entry_on_all_release_targets"],
    req["platform_requirements"]["learning_flow_is_most_important_entry_on_all_release_targets"],
)
check_equal(
    "space_entry_requirement-memory",
    platform["entry_priority_by_surface"]["physical_space_is_top_level_entry_on_all_release_targets"],
    req["platform_requirements"]["physical_space_is_top_level_entry_on_all_release_targets"],
)


# Audio owner: interactions.
check_equal(
    "audio_autoplay requirement-memory",
    interactions["audio_binding_policy"]["auto_play"],
    req["audio_role"]["auto_play"],
)
check_equal(
    "audio_autoplay product-core",
    interactions["audio_binding_policy"]["auto_play"],
    product["audio_product_role"]["auto_play"],
)
check_equal(
    "front_side_subtitles requirement-memory",
    interactions["audio_binding_policy"]["front_side_subtitles"],
    req["audio_role"]["front_side_subtitles"],
)
check_equal(
    "front_side_subtitles product-core",
    interactions["audio_binding_policy"]["front_side_subtitles"],
    product["audio_product_role"]["front_side_subtitles"],
)
check_equal(
    "back_text_or_transcript requirement-memory",
    interactions["audio_binding_policy"]["back_side_text_or_transcript_may_exist"],
    req["audio_role"]["back_side_text_or_transcript_may_exist"],
)
check_equal(
    "back_text_or_transcript product-core",
    interactions["audio_binding_policy"]["back_side_text_or_transcript_may_exist"],
    product["audio_product_role"]["back_side_text_or_transcript_may_exist"],
)
