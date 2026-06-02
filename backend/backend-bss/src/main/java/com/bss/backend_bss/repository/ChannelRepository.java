package com.bss.backend_bss.repository;

import com.bss.backend_bss.entity.Channel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * JpaSpecificationExecutor enables findAll(Specification, Pageable) for the
 * dynamic filter endpoint. Without it we'd need a custom @Query for every
 * filter combination.
 */
@Repository
public interface ChannelRepository
        extends JpaRepository<Channel, String>, JpaSpecificationExecutor<Channel> {

    boolean existsById(String id);

    /**
     * Channels that have the given source linked. Used by the Manage > Sources
     * page to decide whether deleting a (channel, source) link can also delete
     * the source entirely (it can if no other channel references it).
     */
    @Query("SELECT c FROM Channel c JOIN c.sources s WHERE s.name = :sourceName")
    List<Channel> findBySourceName(String sourceName);

    /**
     * Rename a channel's primary key in place. JPA can't change an @Id on a
     * managed entity, so this is a native UPDATE. Every FK referencing
     * channel(id) is ON UPDATE CASCADE, so child rows follow automatically.
     *
     * flushAutomatically pushes any pending changes first; clearAutomatically
     * detaches the now-stale persistence context so a subsequent findById(newId)
     * reads fresh from the DB.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE channel SET id = :newId WHERE id = :oldId", nativeQuery = true)
    int renameId(@Param("oldId") String oldId, @Param("newId") String newId);
}